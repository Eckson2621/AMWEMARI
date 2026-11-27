# User-approved application updates

- A published release in EAM Feedback Center is only a notice; it does not deploy code or force an update.
- The application checks for a published release and a waiting Service Worker.
- The user sees the Update / Baadaye prompt only when both are present.
- The waiting Service Worker receives `SKIP_WAITING` only after the user explicitly confirms Update.
- The page reloads only after the approved worker takes control.
- New workers do not call `skipWaiting()` during installation.
- API, authentication, storage, function, RPC, webhook, and authorization-bearing requests are excluded from Service Worker caching.
- Users who choose Baadaye continue using the currently active version.

This change is staged on `feature/manual-user-approved-updates-20261127`. It does not merge to `main`, deploy to production, run database migrations, or modify customer data.
