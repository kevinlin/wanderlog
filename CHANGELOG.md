# Changelog

Notable changes to Wanderlog, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). Releases before 3.2.0 are recorded only in the git history.

## [Unreleased]

## [3.2.1] - 2026-10-18

### Changed

- **Phone layout.** The Agent button is now an icon, like To do. Activities can't be dragged to reorder on a phone any more, so swiping over a card scrolls the panel. Reordering still works on a wider screen.

- **New map markers.** Each kind of place on the map now has its own marker. A stop shows its initials in the same color as its timeline chip. Its look tells you whether it's behind you, today or still ahead. An activity's icon shows what it is: a fork and knife for food, a hiker for a walk. Its marker comes in one of seven colors. Once it's done, it turns muted and gets a green check. Scenic waypoints are small violet diamonds, and search results are white discs until you add them. The first activity you haven't done yet has a "Next" tab.
- **Arriving at a stop.** When you pick a stop, the map flies there first. Then the stop drops into place, and its places appear one after another.
- **Zoomed out**, a stop's places shrink to small dots, so the stops stay easy to read.
- The hover card shows the same icon as the marker.

### Fixed

- **pnpm Local commits.** The repo now pins pnpm 10.34.6 in `package.json` (`packageManager`), and CI reads the same pin. On a machine where corepack defaulted to pnpm 11, the pre-commit hook used to fail before running the tests, because pnpm 11 ignores the `pnpm.overrides` field and tried to reinstall.
- A stop no longer looks finished on its last day. "Today" now follows the trip's own timezone instead of New Zealand time.
- Ticking off an activity no longer zooms the map out to the whole trip.

### Upgrade notes

- The map now needs a Google Maps Map ID with a cloud map style. Do this before you deploy: create the Map ID in Google Cloud Console and import `docs/architecture/map-style.json` as its style. Then set `VITE_GOOGLE_MAPS_MAP_ID` in Vercel for Preview and Production. Without it, the map loads unstyled on Google's demo ID.

## [3.2.0] - 2026-10-17

### Added

- **Trip todos.** A trip can now hold the bookings and checks that have to happen before the day arrives. Each todo has a title and, if you want them, notes, a booking link, and the stop or activity it's for. Two optional dates set its window: "ready from" (when train tickets go on sale, say) and "book by". Done is shared by everyone on the trip.
- **To do button.** It sits next to the agent button with a count of the todos you can act on today, so you see it without opening anything. Tapping it opens one list for the whole trip, grouped as ready now (overdue first), coming up, and done. The count follows the trip's own timezone and turns over at its midnight.
- **Booking chips.** An activity with an open booking shows a ticket chip on its card, and each trip in the library shows its count.
- **Hermes access.** A new `active_todos` database view and a documented Supabase REST contract let a personal agent read what's due, create todos from a pasted list, and tick them off. The contract is in [docs/specs/design_trip-todos.md](docs/specs/design_trip-todos.md#hermes-api-contract-stable).

### Changed

- The offline cache key is now `phase5-v1`, so each device does one fresh load after updating.
- The offline banner now shows for five seconds and then fades, and taps pass through it while it shows. It used to sit over the top-right buttons for as long as you were offline. The disabled controls and the To do list's own note still show that you're offline.

### Fixed

- The offline cache now keeps only writes that can actually run again after a reload, which today means visit check-offs. Other paused writes used to be saved too, and then failed silently on the next launch.
- On a phone, the expanded timeline drops below the top-right buttons. Before, it ran underneath them, and its collapse button was hidden behind the avatar.

### Upgrade notes

- Apply `supabase/migrations/20261017120000_trip_todos.sql` to the hosted database **before** deploying this version, previews included. The app's trip and library queries now read todos and fail against the old schema.
