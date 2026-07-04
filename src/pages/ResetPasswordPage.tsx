import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { LoadingSpinner } from '@/components/Layout/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';

// Supabase's default minimum; the server enforces it too but this gives a
// friendlier inline message before the round trip.
const MIN_PASSWORD_LENGTH = 6;

export const ResetPasswordPage = () => {
  const { session, isLoading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The recovery/invite link carries a PKCE code that the supabase client
  // exchanges for a session on landing (detectSessionInUrl). Until that
  // resolves we wait; if no session appears the link was invalid or expired.
  if (isLoading) {
    return <LoadingSpinner fullScreen message="Verifying your link…" size="lg" variant="adventure" />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await updatePassword(password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-sandy-beige via-white to-lake-blue/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white/80 p-6 shadow-2xl backdrop-blur sm:p-8">
        <h1 className="mb-1 font-bold text-3xl text-gray-900">Set your password</h1>
        {session ? (
          <>
            <p className="mb-6 text-gray-600 text-sm">Choose a new password to finish signing in.</p>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="password">
                  New password
                </label>
                <input
                  autoComplete="new-password"
                  className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-alpine-teal focus:outline-none focus:ring-2 focus:ring-alpine-teal/30"
                  id="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="confirm">
                  Confirm password
                </label>
                <input
                  autoComplete="new-password"
                  className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-alpine-teal focus:outline-none focus:ring-2 focus:ring-alpine-teal/30"
                  id="confirm"
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                  type="password"
                  value={confirm}
                />
              </div>
              <button
                className="flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg bg-alpine-teal px-4 py-2 font-medium text-white transition-colors hover:bg-alpine-teal/90 active:bg-alpine-teal/80 disabled:opacity-50"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting && (
                  <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {isSubmitting ? 'Saving…' : 'Save password'}
              </button>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </form>
          </>
        ) : (
          <>
            <p className="mb-6 text-gray-600 text-sm">This link is invalid or has expired. Request a new one to set your password.</p>
            <Link className="font-medium text-alpine-teal text-sm hover:underline" to="/forgot-password">
              Request a new link
            </Link>
          </>
        )}
      </div>
    </div>
  );
};
