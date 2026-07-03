# feezal dashboards as mobile apps

Three ways to get a feezal dashboard onto a phone — none requires an app
store, accounts, or fees (one honest iOS caveat below).

## Option 1 — PWA (no build at all)

Enable **Site Settings → Progressive Web App** and deploy. Then:

- **Android/Chrome:** open the viewer URL → menu → *Add to Home Screen* (or
  accept the install banner).
- **iOS/Safari:** share menu → *Add to Home Screen*.

The dashboard launches standalone (no browser chrome), uses your configured
app icon, and the app shell works offline. This is the right choice for most
setups — zero tooling, updates instantly with every deploy.

## Option 2 — Native app (Capacitor project export)

For a real installed app — e.g. kiosk devices, Android settings like
"lock task mode", or just preference — export a ready-to-build
[Capacitor](https://capacitorjs.com/) project:

**Deploy menu (▾) → Mobile app…** (or Site Settings → Mobile app →
*Export project…*). The dialog lets you set the app name and app ID and warns
if your broker address points at `localhost` (a phone can't reach that).

The downloaded ZIP contains the project with your dashboard embedded and a
**personalised README.md with the full step-by-step** — the short version:

```
npm install
npm run android     # or: npm run ios (on a Mac)
```

- **Android:** Android Studio opens; enable USB debugging on the phone and
  press Run. The install is permanent — no Google account, no Play Store.
- **iOS:** Xcode opens (Mac required); sign with a **free Apple ID** and run
  on your device. Free-account apps stop launching after **7 days** — press
  Run again to re-sign, or join the paid Developer Program ($99/year) for
  1-year signing and distribution to other devices.
- `npm run assets` generates all native icons and splash screens from your
  PWA icon (shipped as `resources/icon.png`).

Requirements: [Node.js](https://nodejs.org/) 20+, plus
[Android Studio](https://developer.android.com/studio) (Android) or Xcode 15+
on a Mac (iOS). These run on **your** computer — the feezal server never
runs Gradle or Xcode itself (but see Option 3 for builds in Docker).

## Option 3 — Let the server build the APK (Docker, opt-in)

If the machine running feezal is a capable x86_64 host with Docker, feezal
can build the Android APK for you — no toolchain on your computer at all.

Enable it by starting feezal with **`FEEZAL_DOCKER_BUILDS=1`** and (when
feezal itself runs as a container) the Docker socket mounted
(`-v /var/run/docker.sock:/var/run/docker.sock`). The export dialog then
shows an extra **Build APK on server** button: the build log streams live,
and when it finishes you download a ready-to-sideload `app-debug.apk` —
install it with `adb install app-debug.apk` or by opening the file on the
phone (allow "install from unknown sources").

What to expect:

- The **first build** downloads the ~5 GB Android build image and the Gradle
  dependencies — 10–30 minutes depending on your connection. **Warm builds
  take ~2–3 minutes** (caches persist in the `feezal-gradle-cache` /
  `feezal-npm-cache` Docker volumes).
- The APK is **debug-signed** — perfect for sideloading on your own devices;
  Play-Store release signing is out of scope.
- Your app icon is baked in automatically.
- Not available on ARM hosts (Raspberry Pi & co) — the Android build tools
  are x86_64-only; use Option 2 there.

### Why no iOS build on the server, ever

Xcode only runs on macOS, Apple's license forbids macOS VMs on non-Apple
hardware, and unsigned IPAs cannot be sideloaded. iOS always goes through
Option 2 and Xcode on a Mac.

### Updating the app after dashboard changes

Re-export the project (or just replace its `www/` folder with a fresh static
export) and run `npm run sync`, then Run again from the IDE.
