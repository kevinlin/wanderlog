import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_LINK_CLASS,
  AuthCard,
  FOCUS_RING_CLASS,
  FormError,
  Spinner,
  SubmitButton,
} from '@/components/Auth/AuthCard';
import { useAuth } from '@/contexts/AuthContext';

const GoogleIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z"
      fill="#4285F4"
    />
    <path
      d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
      fill="#34A853"
    />
    <path d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4.01-3.1Z" fill="#FBBC05" />
    <path d="M12 4.77c1.76 0 3.34.6 4.59 1.79l3.44-3.44A11.98 11.98 0 0 0 1.27 6.61l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z" fill="#EA4335" />
  </svg>
);

export const LoginForm = () => {
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stays pending on success: the browser is navigating away to Google.
  const handleGoogleSignIn = async () => {
    setError(null);
    setIsRedirecting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
      setIsRedirecting(false);
    }
  };

  return (
    <AuthCard title="Wanderlog">
      <p className="mb-6 text-gray-600 text-sm">Your interactive travel journal — sign in to view your trips</p>
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
        <div>
          <label className={AUTH_LABEL_CLASS} htmlFor="password">
            Password
          </label>
          <input
            autoComplete="current-password"
            className={AUTH_INPUT_CLASS}
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
        <div className="text-right">
          <Link className={AUTH_LINK_CLASS} to="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <SubmitButton isPending={isSubmitting} pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
        <FormError message={error} />
      </form>
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-300" />
        <span className="text-gray-500 text-sm">or</span>
        <div className="h-px flex-1 bg-gray-300" />
      </div>
      <button
        className={`flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 ${FOCUS_RING_CLASS}`}
        disabled={isRedirecting}
        onClick={handleGoogleSignIn}
        type="button"
      >
        {isRedirecting ? <Spinner className="border-gray-500" /> : <GoogleIcon />}
        Continue with Google
      </button>
    </AuthCard>
  );
};
