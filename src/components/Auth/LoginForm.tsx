import { type FormEvent, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export const LoginForm = () => {
  const { signIn } = useAuth();
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
      </div>
    </div>
  );
};
