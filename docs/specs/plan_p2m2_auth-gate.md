# Auth Gate (Phase 2, M2) Implementation Plan

**Goal:** The app is fully login-protected behind route guards with polished email/password and Google sign-in, production moves to Vercel, and GitHub Pages retires (Requirements 2, 6.4).

**Architecture:** react-router replaces conditional rendering at the top level: `/login`, `/trips/:tripId`, and `/` (redirect to the last-selected trip). A `ProtectedRoute` wrapper enforces the gate client-side; RLS (live since M1) enforces it server-side. Google sign-in uses supabase-js PKCE flow - no dedicated callback route needed. Sign-out purges the query cache and its IndexedDB persistence.

**Tech Stack:** react-router v7, @supabase/supabase-js v2 (Auth + PKCE), TanStack Query v5, Vercel, Google Cloud OAuth.

## Global Constraints

- Prerequisite: M1 shipped ([plan_p2m1_supabase-foundation.md](plan_p2m1_supabase-foundation.md)) - `AuthProvider`/`useAuth`, `LoginForm`, `queryClient`/`persister`, `viewStateStorage`, Vercel previews all existed.
- No schema or RLS changes this milestone.
- Secrets: the Google OAuth client secret lives only in the Supabase dashboard provider config - never in the repo or Vercel env.
- Interim dual-hosting: GH Pages (base `/wanderlog/`) stayed production until Task 6; all router code works under both base paths via `basename={import.meta.env.BASE_URL}`.

---

### Task 1: Introduce react-router

Added `react-router` and turned `App.tsx` into a router shell with routes `/login`, `/`, `/trips/:tripId`, and a `*` catch-all. Extracted the authenticated trip UI into `TripPage`, which reads `:tripId` from the route and records it via `setCurrentTripId`. `HomeRedirect` sends `/` to the last-selected trip, falling back to `DEFAULT_TRIP_ID = '202512_NZ'` (removed in M3). The router mounts under `basename={import.meta.env.BASE_URL}` so it works under both GH Pages (`/wanderlog/`) and Vercel (`/`). This commit left a one-commit window where `/trips/:tripId` was reachable without a session, but its queries stayed `enabled: !!session`, so no data leaked before Task 2 added the gate.

### Task 2: ProtectedRoute - the client-side gate

Added `ProtectedRoute`: shows a spinner while the session loads, redirects to `/login` (preserving the attempted path in `location.state.from`) when there is no session, and renders children otherwise. Wrapped `/` and `/trips/:tripId`; `LoginPage` bounces already-signed-in users back to `from`. Verified no Supabase REST traffic occurs pre-auth (Req 2.1).

### Task 3: Login page polish

Styled `LoginPage` as a full-viewport frosted-glass card (matching `POIModal`): Wanderlog title, tagline, email/password fields with `autocomplete` attributes for password managers, an `alpine-teal` submit button with pending spinner, verbatim Supabase error text under the form, and mobile-first layout for on-the-road use.

### Task 4: Google sign-in (Req 2.3)

Switched the supabase-js client to the PKCE flow with `detectSessionInUrl` (no dedicated `/callback` route - the OAuth round-trip completes on whatever page the user lands on). Added `signInWithGoogle` to the auth context (redirect back to `window.location.origin + BASE_URL`) and a "Continue with Google" button on `LoginForm`. Google Cloud OAuth client and Supabase provider/URL configuration are dashboard-only; the client ID is public by nature and the secret stays in the Supabase dashboard.

### Task 5: Sign-out with cache purge (Req 2.6)

Added `clearPersistedCache()` in `lib/queryClient.ts` (deletes the `wanderlog-query-cache` IndexedDB key) and wired `signOut` to call `supabase.auth.signOut()`, then `queryClient.clear()`, then `clearPersistedCache()`. Added `UserMenu`, a floating top-right frosted-glass control showing the user's email with a "Sign out" item; on sign-out the auth listener nulls the session and `ProtectedRoute` performs the redirect (no manual navigation).

### Task 6: Production cutover to Vercel

Renamed the preview workflow to `vercel-deploy.yml` and split it: PRs get preview deploys, `main` pushes get test-gated production deploys (Req 6.2). Pointed the production domain, Google Maps key referrer restrictions, Supabase Site URL, and Google OAuth JavaScript origins at the Vercel domain (dashboard steps). GH Pages kept deploying in parallel until Task 7.

### Task 7: Retire GitHub Pages (Req 6.4)

Deleted `.github/workflows/deploy.yml`, collapsed the Vite `base` to `/` (the `basename` trick degrades to a no-op), removed `VITE_BASE_PATH` from the Vercel env, disabled repo Pages, dropped the GH Pages origin from the Maps key referrer list, and documented the retired `https://kevinlin.github.io/wanderlog/` URL in the README.

### Task 8: M2 verification gate (Req 2) + sign-off

Verified Req 2 and Req 6.1/6.4 against production (https://wanderlog-xi.vercel.app): pre-auth zero `*.supabase.co/rest/*` requests, family email/password + Google sign-in work, sign-up rejected (signups-disabled), session survives a full browser restart, sign-out purges the `sb-*-auth-token` and IndexedDB query cache, anonymous REST returns `[]`, and the old GH Pages URL 404s. Marked the M2 row `Shipped` in `plan_wanderlog-phase-2.md`.

---

## Critical Files - Summary

| Path | Role |
|------|------|
| `src/App.tsx` | Router shell: route table with `ProtectedRoute`-wrapped authenticated routes. |
| `src/pages/TripPage.tsx` | Authenticated trip UI (map/timeline/activities); reads `:tripId`, records it via `setCurrentTripId`. |
| `src/pages/LoginPage.tsx` | Frosted-glass login surface (email/password + Google), redirects signed-in users. |
| `src/pages/HomeRedirect.tsx` | Redirects `/` to the last-selected trip. |
| `src/components/Auth/ProtectedRoute.tsx` | Client-side auth gate: spinner / `/login` redirect / children. |
| `src/components/Auth/UserMenu.tsx` | Floating control with sign-out. |
| `src/contexts/AuthContext.tsx` | `signInWithGoogle` (PKCE), `signOut` with cache purge. |
| `src/config/supabase.ts` | supabase-js client configured for the PKCE flow. |
| `src/lib/queryClient.ts` | `clearPersistedCache()` deletes the persisted query cache. |
| `.github/workflows/vercel-deploy.yml` | Preview (PR) + production (main) deploy pipeline. |

## Self-Review Notes

- Task 1 leaves a one-commit window where `/trips/:tripId` renders without a session but fetches nothing (queries stay `enabled: !!session`); Task 2 closes it. Acceptable because commits within a milestone are not deploys - production cutover happens in Task 6, after the gate is complete.
- The `basename` trick keeps the router working on both GH Pages (`/wanderlog/`) and Vercel (`/`) during the dual-hosting window, then degrades to a no-op after Task 7.
- `/trips` (library) is deliberately absent from the route table - it arrives in M3; the catch-all redirects unknown paths home.
- Google provider secret handling: client ID is public by nature, the secret stays in the Supabase dashboard only.

## Changelog

- 2026-07-04 — **Compacted post-implementation.** Removed step-by-step tasks, code snippets, `Files:`/`Interfaces:` preambles, and verification command lists now that M2 has shipped. Preserved Goal/Architecture, Global Constraints, Self-Review Notes, and added a Critical Files summary. Original plan recoverable via git history.
- 2026-07-03: Initial plan.
- 2026-07-04: Tasks 1-7 code shipped (react-router, ProtectedRoute, login polish, Google sign-in PKCE, sign-out with cache purge, Vercel deploy workflow, GH Pages retirement). Remaining before Task 8 sign-off: manual dashboard setup (Google OAuth client + Supabase provider/URL config, Vercel domain + env cleanup, Maps key referrers, repo Pages disable), push to main, and production verification.
- 2026-07-04: Task 8 verification gate passed against production (https://wanderlog-xi.vercel.app). Automated checks: pre-auth zero supabase requests, signup rejected (422 signup_disabled), anonymous REST returns [], sign-out purges token + IndexedDB cache, checkmark toggle persists round-trip, GH Pages URL 404s. Manual confirmations: Google sign-in round-trips, family accounts work, session survives browser restart. M2 signed off.
