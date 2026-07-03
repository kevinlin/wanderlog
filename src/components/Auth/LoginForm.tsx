import { type FormEvent, useState } from 'react';
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

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-sandy-beige via-white to-lake-blue/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white/80 p-6 shadow-2xl backdrop-blur sm:p-8">
        <h1 className="mb-1 font-bold text-3xl text-gray-900">Wanderlog</h1>
        <p className="mb-6 text-gray-600 text-sm">Your interactive travel journal — sign in to view your trips</p>
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
          <div>
            <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-alpine-teal focus:outline-none focus:ring-2 focus:ring-alpine-teal/30"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
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
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </form>
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-300" />
          <span className="text-gray-500 text-sm">or</span>
          <div className="h-px flex-1 bg-gray-300" />
        </div>
        <button
          className="flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
          onClick={handleGoogleSignIn}
          type="button"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </div>
    </div>
  );
};
