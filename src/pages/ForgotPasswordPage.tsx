import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
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
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-sandy-beige via-white to-lake-blue/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white/80 p-6 shadow-2xl backdrop-blur sm:p-8">
        <h1 className="mb-1 font-bold text-3xl text-gray-900">Reset password</h1>
        {isSent ? (
          <>
            <p className="mb-6 text-gray-600 text-sm">
              If an account exists for <span className="font-medium">{email}</span>, we sent a link to reset your password. Check your inbox
              and follow the link.
            </p>
            <Link className="font-medium text-alpine-teal text-sm hover:underline" to="/login">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="mb-6 text-gray-600 text-sm">Enter your email and we'll send you a link to set a new password.</p>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="email">
                  Email
                </label>
                <input
                  autoComplete="email"
                  className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-alpine-teal focus:outline-none focus:ring-2 focus:ring-alpine-teal/30"
                  id="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
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
                {isSubmitting ? 'Sending…' : 'Send reset link'}
              </button>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </form>
            <div className="mt-5">
              <Link className="font-medium text-alpine-teal text-sm hover:underline" to="/login">
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
