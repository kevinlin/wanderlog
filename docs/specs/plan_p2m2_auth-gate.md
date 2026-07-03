# Auth Gate (Phase 2, M2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app is fully login-protected behind route guards with polished email/password and Google sign-in, production moves to Vercel, and GitHub Pages retires (Requirements 2, 6.4).

**Architecture:** react-router replaces conditional rendering at the top level: `/login`, `/trips/:tripId`, and `/` (redirect to the last-selected trip). A `ProtectedRoute` wrapper enforces the gate client-side; RLS (already live since M1) enforces it server-side. Google sign-in uses supabase-js PKCE flow - no dedicated callback route needed. Sign-out purges the query cache and its IndexedDB persistence.

**Tech Stack:** react-router v7, @supabase/supabase-js v2 (Auth + PKCE), TanStack Query v5, Vercel, Google Cloud OAuth.

## Global Constraints

- Prerequisite: M1 shipped ([plan_p2m1_supabase-foundation.md](plan_p2m1_supabase-foundation.md)) - `AuthProvider`/`useAuth`, `LoginForm`, `queryClient`/`persister`, `viewStateStorage`, Vercel previews all exist.
- No schema or RLS changes this milestone.
- Secrets: the Google OAuth client secret lives only in the Supabase dashboard provider config - never in the repo or Vercel env.
- Interim dual-hosting: GH Pages (base `/wanderlog/`) stays production until Task 6; all router code must work under both base paths via `basename={import.meta.env.BASE_URL}`.
- After every task: `pnpm test:run` and `pnpm build` green. One commit per task.

---

### Task 1: Introduce react-router

**Files:**
- Create: `src/pages/TripPage.tsx`, `src/pages/LoginPage.tsx`, `src/pages/HomeRedirect.tsx`, `src/pages/__tests__/HomeRedirect.test.tsx`
- Modify: `src/App.tsx`, `package.json`

**Interfaces:**
- Consumes: `useAuth` (M1), `LoginForm` (M1), `getCurrentTripId` from `viewStateStorage` (M1).
- Produces: route table `/login`, `/`, `/trips/:tripId`, `*` - later tasks hang guards and pages off it. `DEFAULT_TRIP_ID = '202512_NZ'` exported from `src/pages/HomeRedirect.tsx`.

- [ ] **Step 1: Add the dependency**

```bash
pnpm add react-router
```

- [ ] **Step 2: Extract the current trip UI into `TripPage`**

Move everything `App.tsx` renders for an authenticated user (map, timeline, activities panel, and their handlers) into `src/pages/TripPage.tsx`. The hardcoded `useTripData({ tripId: '202512_NZ' })` (`App.tsx:20`) becomes:

```tsx
import { useParams } from 'react-router';
import { setCurrentTripId } from '@/services/viewStateStorage';

export const TripPage = () => {
  const { tripId } = useParams<{ tripId: string }>();
  useEffect(() => {
    if (tripId) setCurrentTripId(tripId);
  }, [tripId]);
  const { tripData, isLoading, error, refetch } = useTripData({ tripId: tripId ?? '' });
  // ...existing App content
};
```

- [ ] **Step 3: Write failing test for the home redirect**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/viewStateStorage', () => ({
  getCurrentTripId: vi.fn(() => 'my-last-trip'),
}));

import { HomeRedirect } from '../HomeRedirect';

describe('HomeRedirect', () => {
  it('redirects / to the last selected trip', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/trips/:tripId" element={<div>trip page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('trip page')).toBeInTheDocument();
  });
});
```

Run: `pnpm vitest run src/pages/__tests__/HomeRedirect.test.tsx` - expected FAIL (module not found).

- [ ] **Step 4: Implement `HomeRedirect` and the route table**

```tsx
// src/pages/HomeRedirect.tsx
import { Navigate } from 'react-router';
import { getCurrentTripId } from '@/services/viewStateStorage';

export const DEFAULT_TRIP_ID = '202512_NZ';

export const HomeRedirect = () => (
  <Navigate to={`/trips/${getCurrentTripId() ?? DEFAULT_TRIP_ID}`} replace />
);
```

```tsx
// src/App.tsx becomes the router shell
import { BrowserRouter, Route, Routes } from 'react-router';

const App = () => (
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/trips/:tripId" element={<TripPage />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  </BrowserRouter>
);
```

`LoginPage` for now just renders the M1 `LoginForm` centered; Task 3 polishes it. The M1 conditional gate in `App.tsx` (session ? app : LoginForm) is removed - Task 2 replaces it with `ProtectedRoute`; until then `/trips/:tripId` is reachable without a session, but its queries stay disabled (`enabled: !!session`), so no data leaks in the interim commit.

- [ ] **Step 5: Verify and commit**

```bash
pnpm test:run && pnpm build
pnpm dev   # /: redirects to /trips/202512_NZ; /login renders the form
git add -A && git commit -m "feat: introduce react-router with login, home and trip routes"
```

---

### Task 2: ProtectedRoute - the client-side gate

**Files:**
- Create: `src/components/Auth/ProtectedRoute.tsx`, `src/components/Auth/__tests__/ProtectedRoute.test.tsx`
- Modify: `src/App.tsx`, `src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `useAuth` (M1).
- Produces: `<ProtectedRoute>{children}</ProtectedRoute>` - wraps every authenticated route now and in M3/M4.

- [ ] **Step 1: Write failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

import { ProtectedRoute } from '../ProtectedRoute';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/secret" element={<ProtectedRoute><div>secret</div></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>
  );

describe('ProtectedRoute', () => {
  it('redirects to /login without a session', () => {
    mockUseAuth.mockReturnValue({ session: null, isLoading: false });
    renderAt('/secret');
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('renders children with a session', () => {
    mockUseAuth.mockReturnValue({ session: { user: {} }, isLoading: false });
    renderAt('/secret');
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('shows the spinner while the session is loading', () => {
    mockUseAuth.mockReturnValue({ session: null, isLoading: true });
    renderAt('/secret');
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });
});
```

Run to verify failure, then implement:

```tsx
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/Layout/LoadingSpinner';

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
};
```

- [ ] **Step 2: Wire the gate into the route table**

Wrap `/` and `/trips/:tripId` elements in `<ProtectedRoute>`. In `LoginPage`, redirect signed-in users back:

```tsx
const { session } = useAuth();
const location = useLocation();
if (session) return <Navigate to={(location.state as { from?: string })?.from ?? '/'} replace />;
```

- [ ] **Step 3: Verify no data is fetched pre-auth (Req 2.1)**

Add to the ProtectedRoute test file: render `TripPage` route without a session and assert the mocked `fetchTripById` was never called. Manual: incognito `pnpm dev`, network tab shows zero requests to `*.supabase.co/rest/*` before sign-in.

- [ ] **Step 4: Commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: guard authenticated routes behind login"
```

---

### Task 3: Login page polish

**Files:**
- Modify: `src/pages/LoginPage.tsx`, `src/components/Auth/LoginForm.tsx`

**Interfaces:**
- Consumes: `signIn` from `useAuth` (M1).
- Produces: the final login surface Google sign-in (Task 4) drops its button into.

- [ ] **Step 1: Style the page**

Full-viewport centered card matching the app's frosted-glass style (`backdrop-blur`, `bg-white/80`, rounded corners like `POIModal`): Wanderlog title, tagline, email + password fields, `bg-alpine-teal` submit button. Form behavior:

- `autocomplete="email"` / `autocomplete="current-password"` so password managers work
- Submit disabled + spinner while the sign-in promise is pending
- Supabase error message rendered under the form in `text-red-600` (wrong password, rate limit - shown verbatim)
- Enter submits; the whole flow works on a phone viewport (mobile-first, this is used on the road)

- [ ] **Step 2: Verify and commit**

Existing `LoginForm` tests keep passing (submit → `signIn`, error rendering). Manual check at `/login` in desktop + mobile widths.

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: polish login page"
```

---

### Task 4: Google sign-in (Req 2.3)

**Files:**
- Modify: `src/config/supabase.ts`, `src/contexts/AuthContext.tsx`, `src/components/Auth/LoginForm.tsx`, `src/contexts/__tests__/AuthContext.test.tsx`

**Interfaces:**
- Produces: `signInWithGoogle(): Promise<void>` on the `useAuth` context value.

- [ ] **Step 1: Provider setup (manual, two dashboards)**

Google Cloud Console (https://console.cloud.google.com > APIs & Services > Credentials):
1. Create an OAuth 2.0 Client ID (type: Web application).
2. Authorized JavaScript origins: `http://localhost:5173`, the Vercel production domain.
3. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.

Supabase dashboard (Authentication > Providers > Google): enable, paste client ID + secret. Authentication > URL Configuration: Site URL = production domain; Additional Redirect URLs = `http://localhost:5173/**` and the Vercel preview pattern (e.g. `https://*-<team>.vercel.app/**`).

- [ ] **Step 2: Switch the client to PKCE**

In `src/config/supabase.ts`:

```typescript
client = createClient(url, anonKey, {
  auth: { flowType: 'pkce', detectSessionInUrl: true },
});
```

`detectSessionInUrl` completes the OAuth round-trip on whatever page the user lands on - no `/callback` route (per design).

- [ ] **Step 3: Add the context method + button (test first)**

Test (extend `AuthContext.test.tsx`; add `signInWithOAuth: mockSignInWithOAuth` to the mocked `auth` object):

```tsx
it('signInWithGoogle starts the oauth flow with a same-origin redirect', async () => {
  mockSignInWithOAuth.mockResolvedValue({ error: null });
  // render provider, call signInWithGoogle from a probe component
  expect(mockSignInWithOAuth).toHaveBeenCalledWith({
    provider: 'google',
    options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
  });
});
```

Implementation in `AuthContext`:

```typescript
const signInWithGoogle = async () => {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
  });
  if (error) throw new Error(error.message);
};
```

`LoginForm` gets a "Continue with Google" button (white, bordered, Google G icon inline SVG) under an "or" divider.

- [ ] **Step 4: Verify and commit**

Manual: Google sign-in round-trips on localhost and on a Vercel preview; the family Google accounts land signed in.

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: add google sign-in via supabase oauth pkce"
```

---

### Task 5: Sign-out with cache purge (Req 2.6)

**Files:**
- Create: `src/components/Auth/UserMenu.tsx`
- Modify: `src/lib/queryClient.ts`, `src/contexts/AuthContext.tsx`, `src/pages/TripPage.tsx`, `src/contexts/__tests__/AuthContext.test.tsx`

**Interfaces:**
- Consumes: `persister` key `'wanderlog-query-cache'` (M1 Task 7).
- Produces: `clearPersistedCache(): Promise<void>` in `lib/queryClient.ts`; `UserMenu` floating control rendered on `TripPage`.

- [ ] **Step 1: Test first - sign-out clears everything**

Extend `AuthContext.test.tsx` (mock `idb-keyval`):

```tsx
it('signOut clears supabase session, query cache and persisted cache', async () => {
  // call signOut from a probe
  expect(mockAuthSignOut).toHaveBeenCalled();
  expect(mockIdbDel).toHaveBeenCalledWith('wanderlog-query-cache');
});
```

- [ ] **Step 2: Implement**

```typescript
// lib/queryClient.ts
import { del } from 'idb-keyval';
const PERSIST_KEY = 'wanderlog-query-cache';
// use PERSIST_KEY in createAsyncStoragePersister({ key: PERSIST_KEY, ... })
export const clearPersistedCache = (): Promise<void> => del(PERSIST_KEY);
```

```typescript
// AuthContext signOut
const signOut = async () => {
  await getSupabase().auth.signOut();   // clears the supabase-js localStorage token
  queryClient.clear();
  await clearPersistedCache();
};
```

`UserMenu`: fixed top-right floating button (same frosted-glass treatment as the map controls) showing the user's email initial; click opens a small menu with the email address and a "Sign out" item. On sign-out the auth listener nulls the session and `ProtectedRoute` redirects to `/login` - no manual navigation.

- [ ] **Step 3: Verify and commit**

Manual: sign out → login screen; DevTools > Application: IndexedDB `keyval-store` has no `wanderlog-query-cache`, localStorage has no `sb-*-auth-token` (Req 2.6).

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: add user menu with sign-out and cache purge"
```

---

### Task 6: Production cutover to Vercel

**Files:**
- Modify: `.github/workflows/vercel-preview.yml` (rename to `vercel-deploy.yml`)

**Interfaces:**
- Consumes: M1 Task 13 pipeline (test-gated previews).
- Produces: `main` pushes deploy to Vercel production; PRs keep getting previews (Req 6.2).

- [ ] **Step 1: Split preview vs production in the workflow**

```yaml
name: Vercel Deploy
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:run
      - if: github.event_name == 'pull_request'
        run: |
          pnpm dlx vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}
          pnpm dlx vercel build --token=${{ secrets.VERCEL_TOKEN }}
          pnpm dlx vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }}
      - if: github.event_name == 'push'
        run: |
          pnpm dlx vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
          pnpm dlx vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
          pnpm dlx vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

- [ ] **Step 2: Point everything at the production domain (manual)**

- Vercel: confirm the production domain (default `<project>.vercel.app` or a custom one).
- Google Maps key referrer restrictions: add the production domain (Req 7).
- Supabase Site URL: set to the production domain (Task 4 may have pre-set it - confirm).
- Google OAuth client JavaScript origins: confirm the production domain is listed.

- [ ] **Step 3: Ship and verify**

```bash
git add .github/workflows/
git commit -m "ci: deploy main to vercel production"
git push
gh run watch
```

On the production URL: login → trip renders → toggle a checkmark → sign out. GH Pages still deploys in parallel (retired next task).

---

### Task 7: Retire GitHub Pages (Req 6.4)

**Files:**
- Delete: `.github/workflows/deploy.yml`
- Modify: `vite.config.ts`, `README.md`

- [ ] **Step 1: Remove the workflow and the base-path switch**

Delete `.github/workflows/deploy.yml`. In `vite.config.ts` the env-driven base from M1 Task 13 collapses to root:

```typescript
base: '/',
```

Remove `VITE_BASE_PATH` from the Vercel project env (manual). The `basename={import.meta.env.BASE_URL}` in `App.tsx` stays - it now resolves to `/` and keeps working.

- [ ] **Step 2: Document the retirement**

README deployment section: production URL is the Vercel domain; note "The former GitHub Pages URL (https://kevinlin.github.io/wanderlog/) is retired." Repo Settings > Pages: disable (manual). Remove the GH Pages origin from the Maps key referrer list (manual).

- [ ] **Step 3: Verify and commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "chore: retire github pages hosting"
git push
gh run watch   # only the Vercel workflow runs; it must be green
```

---

### Task 8: M2 verification gate (Req 2) + sign-off

**Files:**
- Modify: `docs/specs/plan_wanderlog-phase-2.md` (M2 status)

All checks run against the production URL:

- [ ] Incognito: only the login screen renders; network tab shows zero `*.supabase.co/rest/*` requests before sign-in (Req 2.1)
- [ ] Every family member's email/password signs in and sees the trip (Req 2.2)
- [ ] Google sign-in round-trips and lands signed in (Req 2.3)
- [ ] Sign-up is rejected: in the browser console on the login page, `supabase.auth.signUp({email:'x@y.z',password:'pw12345678'})` returns a signups-disabled error (Req 2.4)
- [ ] Session survives a full browser quit + reopen without re-login (Req 2.5)
- [ ] Sign-out returns to login; IndexedDB query cache and `sb-*-auth-token` localStorage entry are gone (Req 2.6)
- [ ] Server-side enforcement: `curl -s "https://<project-ref>.supabase.co/rest/v1/trips" -H "apikey: <anon-key>"` returns `[]` (Req 2.7)
- [ ] Old GH Pages URL is retired and documented; production domain serves the app at the root path (Req 6.1, 6.4)

- [ ] **Sign off**

Set the M2 row in `plan_wanderlog-phase-2.md` to `Shipped (<date>)`.

```bash
git add docs/specs/plan_wanderlog-phase-2.md
git commit -m "docs: mark M2 auth gate shipped"
```

---

## Self-Review Notes

- Task 1 leaves a one-commit window where `/trips/:tripId` renders without a session but fetches nothing (queries stay `enabled: !!session`); Task 2 closes it. Acceptable because commits within a milestone are not deploys - production cutover happens in Task 6, after the gate is complete.
- The `basename` trick keeps the router working on both GH Pages (`/wanderlog/`) and Vercel (`/`) during the dual-hosting window, then degrades to a no-op after Task 7.
- `/trips` (library) is deliberately absent from the route table - it arrives in M3; the catch-all redirects unknown paths home.
- Google provider secret handling: client ID is public by nature, the secret stays in the Supabase dashboard only.

## Changelog

- 2026-07-03: Initial plan.
