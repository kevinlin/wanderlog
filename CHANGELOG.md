# Changelog

Notable changes to Wanderlog, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). Releases before 3.2.0 are recorded only in the git history.

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
