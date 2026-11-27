# User-approved application updates

- Each published build uses a new immutable Service Worker cache name.
- IndexedDB stores the version selected on this browser/device; the choice is local to that device and browser profile.
- On the first upgrade using this mechanism, the new worker pins the previous shell if no selection exists.
- A new worker may activate after tabs close, but activation does not change the selected version.
- The active worker serves the selected version's cached app shell and static assets until the user explicitly chooses Update.
- EAM Feedback Center's published release notice is shown when a newer cached version exists.
- Baadaye dismisses that release notice on this device without changing the selected version.
- Update sends APPROVE_UPDATE; the selected cache is persisted before the waiting worker is allowed to activate.
- Previous version caches are retained to support users who defer and to preserve a rollback path; cache eviction by the browser or clearing site data remains outside application control.
- Only the app shell and static assets are cached. API, authentication, storage, functions, RPC, health, webhook, authorization-bearing, and non-static dynamic requests are not cached.
- Database changes must remain backward-compatible with users who defer updates. No destructive migration is part of this workflow.

This work is staged on `feature/manual-user-approved-updates-20261127`. It does not merge to `main`, deploy to production, run database migrations, release a version, or modify customer data.