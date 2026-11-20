# AMWEMARI Android Security Companion — implementation brief

This folder reserves the native Android companion scope. It is intentionally not a fake web wrapper.

## Planned stack
- Kotlin + Android Gradle Plugin (versions to be pinned when the Android project is bootstrapped).
- Firebase Cloud Messaging for user-visible critical alerts.
- Android notification channels and runtime notification permission.
- WorkManager for deferrable scheduled checks.
- Storage Access Framework / MediaStore for user-selected and permitted file access.
- PackageManager APIs subject to Android package-visibility rules.

## Permission and privacy model
- Explain each permission before requesting it.
- Request Android 13+ `POST_NOTIFICATIONS` at runtime.
- Scan only files the user selects or that Android explicitly makes available to the app.
- Do not request Accessibility, SMS, call-log, contacts, or broad all-files access unless a separately justified, policy-compliant feature truly requires it. The initial release does not need these permissions.
- Never inspect other apps' private sandboxes or extract their credentials/messages.
- URL checks use reputation and phishing indicators; they do not guarantee a site is safe.

## Background and alarm behavior
- FCM is the primary server-to-device urgent alert channel.
- Use a high-importance notification channel, sound, vibration, and an alarm-style in-app screen where the user has granted permission.
- Do not promise to override Do Not Disturb, silent mode, OS notification controls, force-stop, or manufacturer battery restrictions.
- Keep any foreground service user-visible and only for a valid ongoing task; do not run covert continuous monitoring.

## First milestone
Create the Android Gradle project, app identity, notification permission onboarding, a test-only local critical alert, FCM token registration authenticated to the AMWEMARI account, and secure token revocation on logout/device removal. Do not connect live threat events until backend authorization and event validation are complete.


## Android prototype implemented on `security-foundation`

The native Kotlin app now includes:
- Android 13+ notification permission request and a high-importance local test alert.
- User-selected file triage through the Storage Access Framework, streaming SHA-256 calculation, a 50 MB prototype limit, and basic file-signature identification.
- A limited inventory of launcher apps visible through Android package-visibility rules; this is not a malware scan of those apps.
- Local URL-structure indicators (HTTPS, embedded credentials, punycode and unusual ports); no online reputation lookup is performed.
- An explicit warning that `UNVERIFIED` is not a clean verdict and that Android does not allow unrestricted access to other apps' private data.
- The missing AndroidX Core dependency is now declared in the app Gradle file.

The app still does not connect to Supabase, the Super Admin device registry, Firebase Cloud Messaging, or live security events. No APK build or physical-device test has been completed. The scanner is a safe triage prototype, not an antivirus engine.


## Super Admin identity and device binding

The Android prototype now signs in through Supabase Auth using the official Super Admin account. The Edge Function remains the authority: it checks the authenticated user against the fixed Super Admin email and the Super Admin registry before issuing a device secret.

- Access/refresh tokens and the device proof are encrypted with an AES-GCM key held by Android Keystore.
- The password is used for the sign-in request only and is not persisted by the app.
- Each installation has a separate device key and secret. A second phone signs in with the same Super Admin identity and enrolls as another device.
- A revoked installation fails its heartbeat. Re-enrollment requires the explicit re-enroll action, which creates a new installation key.
- Selected-file scan metadata (name, size, SHA-256, signature and local triage label) can be sent to the Cyber Admin function; the file contents are never uploaded by this prototype.

This is source-level integration. It still requires a successful Gradle build, a physical Android test, and live end-to-end validation against the Super Admin account before it can be considered operational.
