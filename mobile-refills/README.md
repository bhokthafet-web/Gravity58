# G58 Refills — Android app

A thin Capacitor/WebView wrapper around the live Refills site (`https://g58.in/digit58/`).
It does **not** bundle a frozen copy of the site — every load fetches the current
`digit58/app.js`/`styles.css` from g58.in, so web fixes and features apply immediately
without needing a new APK build. App id `in.g58.refills`, name "G58 Refills".

## Why a live-loading wrapper instead of a bundled copy

The previous GRAVITY58 Android app (`downloads/GRAVITY58-Android-v1.3.apk`) bundles a
frozen snapshot of the whole site at build time, so installed copies run stale JS until
manually reinstalled. This app intentionally avoids that by pointing `server.url` at the
real site (`capacitor.config.json`), so it always reflects what's live.

## Rebuilding

Requires Node.js, and Android Studio's SDK + bundled JDK.

```bash
export ANDROID_HOME=~/Library/Android/sdk
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

npm install
npx cap sync android
cd android && ./gradlew assembleDebug
# APK at android/app/build/outputs/apk/debug/app-debug.apk
```

To regenerate icons/splash from `assets/icon-foreground.png` + `assets/icon-background.png`
(adaptive icon layers) after changing the logo:

```bash
npm install --save-dev @capacitor/assets
npx capacitor-assets generate --android
```

## Signing

This build is **debug-signed only** (Android's default debug keystore), matching the
existing GRAVITY58 app's side-load distribution model — fine for direct APK download and
installation via "install from unknown sources," not eligible for Play Store distribution.
Play Store or auto-verified Android App Links would need a dedicated release keystore
that should be generated and held by whoever owns the app's long-term signing identity —
losing that keystore means future updates can't be installed over the old one.

## Deep links

`AndroidManifest.xml` registers an intent-filter for `https://g58.in/digit58/*`, and
`MainActivity.java` forwards the incoming URL (including the `#store&owner=...&store=...`
hash customers get from their store) into the WebView. This is **not** auto-verified —
without hosting a `https://g58.in/.well-known/assetlinks.json` with this app's signing
certificate fingerprint, Android will prompt the user to choose this app the first time
rather than opening it automatically. That's a reasonable follow-up once a stable release
keystore exists.

## NFC tags

Tapping an NFC tag encoded with an `https://g58.in/digit58/#store&owner=...&store=...`
URI record opens straight to that store's customer page, the same way a deep link does.
`AndroidManifest.xml` adds an `android.nfc.action.NDEF_DISCOVERED` intent-filter matching
the same host/path as the VIEW filter, plus the `android.permission.NFC` permission and
an optional (`required="false"`) `android.hardware.nfc` feature declaration so the app
still installs on devices without NFC hardware. `MainActivity.loadIncomingLink()` handles
`NDEF_DISCOVERED`/`TECH_DISCOVERED`/`TAG_DISCOVERED` the same way it handles `ACTION_VIEW`:
Android already resolves `intent.getData()` to the tag's URI for a simple NDEF URI record
matching the manifest filter, so no manual NDEF payload parsing is needed. To provision a
tag for a store, write its `publicStoreLink()` URL to the tag as an NDEF URI record with
any standard NFC-tools app.
