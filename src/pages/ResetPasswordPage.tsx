import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AUTH_INPUT_CLASS, AUTH_LABEL_CLASS, AUTH_LINK_CLASS, AuthCard, FormError, SubmitButton } from '@/components/Auth/AuthCard';
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
    <AuthCard title="Set your password">
      {session ? (
        <>
          <p className="mb-6 text-gray-600 text-sm">Choose a new password to finish signing in.</p>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className={AUTH_LABEL_CLASS} htmlFor="password">
                New password
              </label>
              <input
                autoComplete="new-password"
                className={AUTH_INPUT_CLASS}
                id="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            <div>
              <label className={AUTH_LABEL_CLASS} htmlFor="confirm">
                Confirm password
              </label>
              <input
                autoComplete="new-password"
                className={AUTH_INPUT_CLASS}
                id="confirm"
                onChange={(event) => setConfirm(event.target.value)}
                required
                type="password"
                value={confirm}
              />
            </div>
            <SubmitButton isPending={isSubmitting} pendingLabel="Saving…">
              Save password
            </SubmitButton>
            <FormError message={error} />
          </form>
        </>
      ) : (
        <>
          <p className="mb-6 text-gray-600 text-sm">This link is invalid or has expired. Request a new one to set your password.</p>
          <Link className={AUTH_LINK_CLASS} to="/forgot-password">
            Request a new link
          </Link>
        </>
      )}
    </AuthCard>
  );
};
