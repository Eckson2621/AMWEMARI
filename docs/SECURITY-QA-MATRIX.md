# AMWEMARI Security QA Matrix

This is a pre-production verification checklist. Passing a source review is not proof of runtime protection.

## A. Notification receiver

- [ ] Valid same-origin path opens the intended AMWEMARI route.
- [ ] External URL (for example `https://attacker.example/`) falls back to `/`.
- [ ] Protocol-relative URL (`//attacker.example/`) falls back to `/`.
- [ ] Backslash URL variants (`/\\\\attacker.example/`) fall back to `/`.
- [ ] URL with embedded credentials falls back to `/`.
- [ ] Missing, malformed, non-JSON, and oversized push payloads do not crash the worker.
- [ ] Non-critical notification does not use the critical alert tag/interaction behavior.
- [ ] Critical notification requests vibration and persistent display, subject to OS/browser permissions.
- [ ] Notification click focuses an existing app tab or opens the app; it never navigates off-origin.

## B. Backend event ingestion (not implemented yet)

- [ ] Only trusted server-side sources can create authoritative events.
- [ ] Client/browser signals are labeled untrusted and cannot set actor, tenant, severity, or source authority.
- [ ] Reject malformed JSON, unknown event types, oversized fields, and oversized details.
- [ ] Rate limit by authenticated principal and network source.
- [ ] Deduplicate using an idempotency fingerprint.
- [ ] Never log passwords, access/refresh tokens, payment details, or file contents.
- [ ] Confirm event table has no anon/authenticated read or write grants.
- [ ] Confirm service-only insert path and restricted Super Admin incident-read path.
- [ ] Verify tenant identifiers are derived from trusted server/database context, not request body.

## C. Authorization and tenant isolation

- [ ] Test owner, employee, accountant, and other existing roles against their current permissions.
- [ ] Test cross-store reads and writes are denied.
- [ ] Test expired/revoked sessions cannot access protected data.
- [ ] Test Super Admin allow-list is enforced server-side, not from editable user metadata.
- [ ] Confirm existing sales, stock, subscription, and accounting totals are unchanged.

## D. Delivery and Android device

- [ ] Register and revoke Web Push/FCM tokens on login, logout, and device removal.
- [ ] Test Android notification permission granted and denied.
- [ ] Test app/browser foreground, background, closed, battery saver, and network loss.
- [ ] Verify delivery status is not marked delivered without provider/device evidence.
- [ ] Verify only confirmed critical incidents trigger the loud alert.
- [ ] Verify DND, force-stop, and OS restrictions are accurately communicated.

## Current status (2026-11-19)

- Service worker push receiver exists on branch `security-foundation`.
- Same-origin notification navigation has been hardened with URL parsing and origin checks.
- Private append-only `private.security_events` ledger is applied in production; forced RLS, service-role-only SELECT/INSERT, and update/delete trigger were verified.
- `amwemari-cyber-admin` Edge Function v4 rejects client-local `critical` and `malicious` findings; independent server verification is required.
- Super Admin incident-read RPC `public.amwemari_get_security_events` is executable only by `service_role`; direct `anon` and `authenticated` execution was verified false. The Edge Function calls it only after validating the user's JWT and fixed Super Admin allow-list. End-to-end live invocation with the Super Admin session remains outstanding.
- Verified the append-only trigger rejects UPDATE inside a rolled-back transaction; no test record was retained.
- Verified all four inline JavaScript blocks in the branch's `index.html` pass syntax compilation.
- [ ] Complete live end-to-end incident read using the actual Super Admin session; static/database checks do not replace this test.
- Branch `security-foundation` includes a Super Admin incident viewer, but the UI is not yet merged to `main` or deployed.
- Trusted service-role-only event ingestion is deployed and its SQL write path was verified in a rolled-back transaction. The RPC throttles each actor/event-type bucket after 20 writes in five minutes; a 21-write transaction test confirmed throttling and the alert record, then rolled back all test data.
- The Edge Function v6 records authenticated non-admin access attempts, malformed/unknown actions, and alert-status changes.
- Gateway-level missing/invalid JWT rejections are not application-ledger entries while `verify_jwt=true`.
- No platform-wide Auth/Storage/database audit feed, push sender, FCM registration, or Android APK is active.
- Android companion now has source-level selected-file SHA-256/signature triage (50 MB cap), limited launcher-app inventory, URL-structure heuristics, and a local test notification. It has not been built or run on a physical device.
- [ ] Build the Android app with Gradle/Android SDK and resolve any compile or dependency issues.
- [ ] Test file-picker permissions, 50 MB limit, SHA-256 output against known test files, misleading file extensions, and error handling on a physical Android device.
- [ ] Verify app inventory returns only packages exposed by Android package visibility and does not request `QUERY_ALL_PACKAGES`.
- [ ] Verify URL heuristic output is clearly labeled as non-reputation, non-verdict information.
- [ ] Connect authenticated FCM token enrollment and revocation only after device registry integration is reviewed.
- Supabase ledger, read RPC, and Edge Function v4 are active in production; the branch's UI and service-worker changes are not deployed.


## Android Super Admin identity checks

- [ ] Confirm only `mwalimueckson2104@gmail.com` can complete device enrollment; a normal account is rejected.
- [ ] Confirm password is not stored and tokens/device secret are encrypted at rest with Android Keystore.
- [ ] Confirm a second Android installation can enroll under the same Super Admin identity with a distinct device key.
- [ ] Revoke one Android device in the PWA; verify heartbeat fails on that device while the other enrolled device remains active.
- [ ] Verify explicit re-enrollment creates a new key and does not silently bypass a revocation.
- [ ] Verify token refresh, session restoration, logout and re-login.
- [ ] Verify selected-file metadata reaches Cyber Lab only after authenticated device proof; confirm file bytes are never uploaded.
- [ ] Build and test all flows on a physical Android device.
