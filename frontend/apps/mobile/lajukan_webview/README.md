# Lajukan Mobile

Flutter mobile shell for Lajukan, targeting Android and iOS from the same repository.

The app keeps Lajukan's existing web experience at https://www.lajukan.com while adding native mobile capabilities such as camera/reels capture, permissions, external app links, system back navigation, and a store-ready packaging pipeline.

## Project

Path:

`frontend/apps/mobile/lajukan_webview`

App identifiers:

- Android: `com.lajukan.app`
- iOS: `com.lajukan.app`

## Run locally

From the repository root:

```bash
cd frontend/apps/mobile/lajukan_webview
flutter pub get
dart run flutter_launcher_icons
flutter run
```

Android installable preview:

```bash
flutter build apk --release
```

The Android release build falls back to the debug key only when no real release keystore is configured. Never ship that fallback to Google Play.

## Android / Play Store

For production, create or keep one upload keystore and protect it permanently. Do not commit the keystore to Git.

Codemagic is configured with the reference:

`lajukan_playstore`

The signed workflow produces an Android App Bundle:

`build/app/outputs/bundle/release/*.aab`

The Play workflow targets the Internal testing track first. Google Play requires an AAB for new app publishing and the same signing key must be preserved for subsequent releases.

Required Codemagic setup:

1. Upload your Android keystore under Code signing identities and name the reference `lajukan_playstore`.
2. Add the Google Play service-account JSON to the secret variable `GOOGLE_PLAY_SERVICE_ACCOUNT_CREDENTIALS` in a variable group named `google_play_credentials`.
3. Create the Play Console app with package name `com.lajukan.app`.
4. Run `android-play-internal`.
5. After internal testing is stable, create a separate production release in Play Console or switch the publishing track deliberately.

For direct sharing with friends, the Android preview workflow produces an installable APK artifact. You can send that APK privately; Play Console internal testing is cleaner for repeated tester builds.

## iOS / App Store / TestFlight

You do not need a physical Mac to run the cloud iOS build in this repository. Codemagic performs the iOS build on hosted macOS machines.

Required Apple setup:

1. Enroll in the Apple Developer Program.
2. Create an App ID for `com.lajukan.app`.
3. Create an App Store Connect app using the same bundle identifier.
4. Add an App Store Connect API key to Codemagic under the integration name `lajukan_appstore_connect`.
5. Configure iOS distribution signing/provisioning for `com.lajukan.app` in Codemagic.
6. Set `APP_STORE_APPLE_ID` to the numeric Apple ID of the App Store Connect app.
7. Run `ios-testflight` for private tester distribution.
8. Use `ios-app-store` only when the App Store listing, privacy information, screenshots, age rating, and other required metadata are ready.

The iOS workflow explicitly checks the Xcode major version before building because current App Store submissions require Xcode 26 or newer.

## Store secrets

Secrets belong in Codemagic, not in GitHub:

- Android keystore + passwords
- Google Play service-account JSON
- App Store Connect API key/private key
- iOS distribution certificate/provisioning profile

Keep independent backups of the Android keystore and Apple signing credentials. Losing the Android upload key can complicate future Play releases.

## CI

GitHub Actions runs Flutter analyze, tests, launcher-icon generation, and an Android debug build whenever the mobile project changes.

Codemagic handles the signed Android/iOS release path because iOS distribution needs Apple signing and a macOS build environment.
