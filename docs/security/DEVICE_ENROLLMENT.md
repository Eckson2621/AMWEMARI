# AMWEMARI Cybersecurity — Super Admin device enrollment

## Goal

Cyber Lab access follows the fixed AMWEMARI Super Admin identity across devices. The current allow-list remains `mwalimueckson2104@gmail.com`; authorization is checked server-side using the verified Supabase Auth user and the Super Admin registry. A browser-side flag or editable user metadata is never accepted as proof.

## Device lifecycle

1. Sign in to AMWEMARI using the official Super Admin account.
2. Open Super Admin → AMWEMARI Cyber Lab.
3. On a new browser/device, choose **Sajili kifaa hiki**. The server creates a device record and returns a random one-time device secret.
4. The browser stores the device key and secret locally. Subsequent Cyber Admin requests include them; the server hashes the secret and verifies an active device record.
5. Super Admin can list enrolled devices and revoke a device. Revocation changes the record to `revoked` and replaces the proof hash, so its old secret can no longer authorize Cyber Lab requests.
6. A revoked device must be enrolled as a new device after fresh Super Admin sign-in.

## Security properties

- The Edge Function keeps JWT verification enabled and verifies the exact Super Admin email and `amwemari_super_admins` record before processing any action.
- The device registry has forced RLS. `anon` and `authenticated` have no table privileges; only the server-side `service_role` can access it.
- The browser never receives the service-role key or the stored device proof hash.
- Device secrets are returned only during enrollment and stored as SHA-256 hashes server-side.
- Revocation is immediate for subsequent requests.
- During rollout only, the existing Super Admin dashboard remains compatible until the first device is enrolled. After at least one active device exists, device proof is mandatory for protected Cyber Admin actions.
- Browser local storage is a prototype credential store and is exposed to same-origin script compromise. Production native Android/Windows agents should use OS-protected storage (Android Keystore / Windows DPAPI or Credential Manager).

## Current limitations

- The PWA device enrollment UI is on the `security-foundation` branch and is not yet in production `main`.
- The backend registry and Edge Function are deployed to Supabase.
- The Android project remains a source prototype; it is not yet connected to Supabase/FCM and no APK has been built or tested.
- The Windows/PC native agent has not yet been built. When a PC is available, build and package a native agent, authenticate it with the same Super Admin account, and store its device secret in Windows-protected storage.
- Device enrollment identifies and authorizes an installation; it does not itself provide antivirus scanning or unrestricted access to the device. Android/Windows permissions and operating-system isolation still apply.

## Database migration

The production migration is `20261119200745_amwemari_cyber_admin_device_registry`. Keep this file in repository migration history so future environments can reproduce the schema.
