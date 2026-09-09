# G58 Team Admin — Android shell

A thin Capacitor WebView wrapper around the private, login-gated
`https://g58.in/team-admin/` console — not the public site. It has no
bundled UI of its own; `capacitor.config.json`'s `server.url` points
directly at the live page, so every change to `team-admin/` ships to
this app automatically with no rebuild.

Package: `in.g58.teamadmin`. Deliberately **not** linked from any
public page (team-admin is `noindex` and admin-only) — the APK is
handed directly to G58 staff, not distributed through the website.

## Build

```
npm install
npx cap sync android
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
```

Debug APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`.
