# AMWEMARI Cybersecurity Foundation

## Current repository facts

- The production application is a static Progressive Web App (PWA): `index.html`, `manifest.json`, and `sw.js`.
- `src/index.js` currently delegates requests to Cloudflare static assets; it is not yet an API/security gateway.
- Supabase is used by the browser application. The public publishable key is expected to be present in the client; no service-role key may be added to browser code.
- The existing Cyber Lab is a user-selected local file triage tool. It computes SHA-256, checks a few file signatures/extensions, and scans a small set of test markers. It is not an antivirus engine, does not inspect every file on Android, and does not establish that a file is clean.
- A separate native Kotlin Android companion now exists under `android-companion/`; it is still a source prototype and is not packaged or connected to live backend events.

## Security architecture

1. **Detection and evidence**
   - Record security events server-side with event ID, UTC timestamp, event category, severity, actor/user ID where known, store/tenant ID where applicable, request correlation ID, and minimized network metadata.
   - Never store passwords, access tokens, refresh tokens, full payment data, or private user files in incident logs.
   - Treat client-reported events as untrusted signals. Server-side verification is authoritative.
2. **Authorization**
   - Super Admin authorization must be checked server-side against a fixed allow-list and trusted database/app metadata.
   - Never authorize using editable user metadata or a client-side boolean.
   - Keep tenant/store isolation in RLS. Enable RLS on every exposed table and use explicit ownership predicates.
   - Keep service-role/secret keys only in server-side secrets.
3. **Response**
   - Start with reversible containment: revoke the affected session where supported, block repeated abusive requests with rate limits, and require re-authentication/MFA for sensitive actions.
   - Preserve evidence and provide a human-reviewed unblock path. Do not automatically delete user data or block a person solely from geolocation/IP reputation.
4. **Notifications**
   - Web Push requires a user-granted notification permission, a Push API subscription, VAPID keys held server-side, and a trusted backend sender. The service worker now has a receiver for incoming push messages; delivery is not active until the subscription and sender are implemented and tested.
   - Critical notifications may request persistent display and vibration, subject to browser, Android, device, and user notification settings. No web app can guarantee bypassing Do Not Disturb or OS restrictions.
5. **Android companion**
   - Continue the native Android app with transparent permission prompts, limited launcher-app inventory, Storage Access Framework scanning of user-selected files, server-backed URL reputation checks, and authenticated FCM alerts. The current source prototype implements only local file-signature/hash triage, limited app inventory, local URL heuristics, and a local test notification.
   - Do not collect other apps' private data, credentials, messages, or files. No covert monitoring, device takeover, or retaliatory access.
   - A real antivirus verdict requires reputable threat intelligence/signature updates and/or a specialist scanning service; hashes and file magic bytes alone are insufficient.

## Initial implementation in this branch

- Service worker cache version advanced to v43.
- Added a Web Push event receiver and notification-click routing.
- The receiver validates that the navigation target is a same-origin relative path.
- This is notification-display plumbing only. It does not register subscriptions, send push messages, detect intrusions, or claim an alert is active.

## Current implementation status (2026-11-19)

- The private append-only `private.security_events` ledger is applied in production Supabase migration `20261119181645_amwemari_security_event_ledger`.
- Verified: forced RLS is enabled; `anon` and `authenticated` have no SELECT/INSERT access; `service_role` has SELECT/INSERT; UPDATE/DELETE are blocked by a trigger.
- The `amwemari-cyber-admin` Edge Function is version 4. It verifies the JWT and exact Super Admin allow-list before any Cyber Lab action, and its dashboard action now reads incident records through the restricted `public.amwemari_get_security_events` RPC.
- The RPC is `SECURITY DEFINER` with an empty search path, checks the fixed Super Admin user ID/email against Auth, is executable only by `service_role`, and clamps result count to 1–200. The Edge Function performs JWT + allow-list checks first, then calls the RPC server-side.
- Local/browser scan findings are untrusted. The Edge Function now rejects client-local `critical` severity and `malicious` verdicts; those require independent server verification.
- The Super Admin incident viewer is now included in `index.html` on branch `security-foundation`; it calls the protected dashboard action. It is not yet merged to `main` or deployed.
- A validated service-role-only event-ingestion RPC writes server-originated events into the private ledger. It enforces a per-actor/per-event-type threshold of 20 writes per five minutes and emits a rate-limit alert when exceeded. The Edge Function uses it for authenticated non-admin access attempts, malformed/unsupported actions, and Super Admin alert-status changes.
- Missing/invalid JWT requests are rejected by the Supabase Edge gateway because JWT verification remains enabled; those gateway rejections are not written into this application ledger.
- The ledger is not yet connected to platform-wide Auth/Storage/database audit feeds or a push sender.

## Required next steps before production activation

1. Add a trusted server-side event ingestion function with schema validation, rate limits, idempotency, and redaction.
2. Add push subscription registration and encrypted storage; keep VAPID private key in Cloudflare/Supabase secrets.
3. Add an authenticated push sender and test delivery on the actual Android device with app closed, browser closed, battery saver, and notification permission denied/granted.
4. Build and test the Android companion as a separate native project and validate Android permission constraints.
5. Run RLS, auth/session, tenant-isolation, dependency, and abuse-case tests before merging the UI/service-worker branch to main or deploying.

## Acceptance criteria

- No production business calculations, sales, stock, subscription, or existing access-control behavior changes.
- Every server-detected critical event has an immutable audit record.
- Only verified Super Admin can read global incidents.
- A notification is marked delivered only after provider/device evidence supports that status; otherwise it remains queued/unknown.
- No claim of full-device scanning, exact attacker identity/location, or guaranteed 30-second identification.
