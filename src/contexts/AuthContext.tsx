import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { getSupabase } from '@/config/supabase';
import { clearPersistedCache, queryClient } from '@/lib/queryClient';

interface AuthContextValue {
  isLoading: boolean;
  resetPassword: (email: string) => Promise<void>;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const PERSISTER_FLUSH_MS = 1500;
// BASE_URL ends with '/', so this appends to it without a leading slash.
const RESET_PASSWORD_PATH = 'reset-password';

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message);
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    if (error) {
      throw new Error(error.message);
    }
  };

  const signOut = async () => {
    await getSupabase().auth.signOut();
    queryClient.clear();
    // The persister re-writes an empty snapshot ~1s after clear() (throttled
    // subscription), so wait for it to settle before purging the entry.
    await new Promise((resolve) => setTimeout(resolve, PERSISTER_FLUSH_MS));
    await clearPersistedCache();
  };

  // Sends a recovery email. The link lands on /reset-password, where the PKCE
  // code is exchanged for a session so updatePassword can run. The same landing
  // page also serves dashboard-issued invitations (see AuthContext docs in the
  // design spec).
  const resetPassword = async (email: string) => {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + import.meta.env.BASE_URL + RESET_PASSWORD_PATH,
    });
    if (error) {
      throw new Error(error.message);
    }
  };

  const updatePassword = async (password: string) => {
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) {
      throw new Error(error.message);
    }
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, resetPassword, signIn, signInWithGoogle, signOut, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
};
