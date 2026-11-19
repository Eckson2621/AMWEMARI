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
- `amwemari-cyber-admin` Edge Function v3 rejects client-local `critical` and `malicious` findings; independent server verification is required.
- Super Admin incident-read RPC `public.amwemari_get_security_events` is deployed with execute granted only to authenticated and an internal fixed Super Admin check. End-to-end authenticated read test remains outstanding.
- Branch `security-foundation` includes a Super Admin incident viewer, but the UI is not yet merged to `main` or deployed.
- No trusted event-ingestion endpoint, push sender, FCM registration, or Android APK is active.
- Supabase ledger, read RPC, and Edge Function v3 are active in production; the branch's UI and service-worker changes are not deployed.
