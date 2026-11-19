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


## Android prototype now present on this branch

A minimal native Kotlin Android project has been bootstrapped under this folder:
- Gradle project and app module configuration.
- Android 13+ notification permission request.
- High-importance notification channel with vibration.
- A user-triggered local test notification, clearly labeled as a test.

This is only a notification-permission and local-display prototype. It does not yet connect to Firebase, AMWEMARI accounts, Supabase, or live security events. It has not been built into an APK or tested on a physical phone. Import `android-companion/` into Android Studio and build it before treating it as a runnable app.
