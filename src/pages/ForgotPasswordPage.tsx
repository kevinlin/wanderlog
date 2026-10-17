import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { AUTH_INPUT_CLASS, AUTH_LABEL_CLASS, AUTH_LINK_CLASS, AuthCard, FormError, SubmitButton } from '@/components/Auth/AuthCard';
import { useAuth } from '@/contexts/AuthContext';

export const ForgotPasswordPage = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await resetPassword(email);
      setIsSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset link');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard title="Reset password">
      {isSent ? (
        <>
          <p className="mb-6 text-gray-600 text-sm" role="status">
            If an account exists for <span className="font-medium">{email}</span>, we sent a link to reset your password. Check your inbox
            and follow the link.
          </p>
          <Link className={AUTH_LINK_CLASS} to="/login">
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <p className="mb-6 text-gray-600 text-sm">Enter your email and we'll send you a link to set a new password.</p>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className={AUTH_LABEL_CLASS} htmlFor="email">
                Email
              </label>
              <input
                autoComplete="email"
                className={AUTH_INPUT_CLASS}
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            <SubmitButton isPending={isSubmitting} pendingLabel="Sending…">
              Send reset link
            </SubmitButton>
            <FormError message={error} />
          </form>
          <div className="mt-5">
            <Link className={AUTH_LINK_CLASS} to="/login">
              Back to sign in
            </Link>
          </div>
        </>
      )}
    </AuthCard>
  );
};
