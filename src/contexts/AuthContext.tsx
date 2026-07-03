import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { getSupabase } from '@/config/supabase';
import { queryClient } from '@/lib/queryClient';

interface AuthContextValue {
  isLoading: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

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
  };

  return <AuthContext.Provider value={{ session, isLoading, signIn, signInWithGoogle, signOut }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
};
