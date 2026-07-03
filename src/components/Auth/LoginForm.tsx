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
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-sandy-beige to-lake-blue/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white/90 p-8 shadow-2xl backdrop-blur-sm">
        <h1 className="mb-1 font-bold text-2xl text-gray-900">Wanderlog</h1>
        <p className="mb-6 text-gray-600 text-sm">Sign in to view your trips</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="email">
              Email
            </label>
            <input
              autoComplete="email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-alpine-teal focus:outline-none focus:ring-2 focus:ring-alpine-teal/30"
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-alpine-teal focus:outline-none focus:ring-2 focus:ring-alpine-teal/30"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            className="w-full rounded-lg bg-alpine-teal px-4 py-2 font-medium text-white transition-colors hover:bg-alpine-teal/90 disabled:opacity-50"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};
