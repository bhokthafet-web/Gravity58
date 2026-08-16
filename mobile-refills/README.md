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

`AndroidManifest.xml` registers an `android:autoVerify="true"` intent-filter for
`https://g58.in/digit58/*`, and `MainActivity.java` forwards the incoming URL (including
the `#store&owner=...&store=...` hash customers get from their store) into the WebView.
This is what makes links tapped in WhatsApp (or anywhere else) open the app directly
instead of falling back to a browser — without a verified App Link, Android/WhatsApp
have no proof the app owns the domain and default to the browser.

Verification is backed by `/.well-known/assetlinks.json` at the repo root, which lists
the SHA256 fingerprint of the certificate the installed APK is signed with. **Today
that's this Mac's debug keystore** (`~/.android/debug.keystore`) — fast to stand up, but
that keystore is random per machine, so an APK rebuilt elsewhere, or resigned with a
proper release keystore, needs `assetlinks.json` updated with the new fingerprint or
verification silently breaks (Android just falls back to the old browser-prompt
behavior, no error surfaced to the user). Regenerate the fingerprint with:

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey \
  -storepass android -keypass android | grep SHA256
```

Moving to a dedicated release keystore (needed for Play Store distribution anyway) means
generating that keystore, signing future builds with it, and swapping the fingerprint in
`assetlinks.json` to match — a deliberate one-time step once someone owns that keystore's
long-term custody.

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

## Cold-start deep link reliability

On a true cold start, Capacitor's bridge begins navigating its `WebView` to the configured
`server.url` at roughly the same time `MainActivity.onCreate()` runs. If the bridge/WebView
isn't fully attached yet the moment `onCreate()` tries to apply an incoming deep link, that
`loadUrl()` call can silently no-op. `MainActivity` now applies the deep link twice on cold
start — immediately, and again ~600ms later — so it reliably wins regardless of that timing.
`onNewIntent()` (the app already running) is unaffected and applies the link once, since
there's no competing initial navigation there.

Separately, a **freshly installed** app's Android App Link verification also runs
asynchronously after install — even forcing it via `pm verify-app-links --re-verify` takes a
few seconds to report `verified` on this project's own test emulator. Until verification
completes, the very first tap on a `g58.in` link after installing may still fall back to a
browser instead of opening the app directly; retrying moments later (once verification has
finished) opens the app as expected. This is an Android OS behavior, not something app code
can fully eliminate.
