# WebSkin

**WebSkin turns any website into a clean, safe app — even sites that never built one.**

It gives any web UI an app-style view so you can use it without pop-ups, spam redirects or clutter, and makes the site easier on the eyes.

## Features (v0.2)

- **Home screen**: search Google or type a site address, with live search suggestions. Saved sites show up as app icons, and recently visited sites are listed.
- **App / Web toggle**: switch any site between the WebSkin app view and the original site. The choice is remembered per site.
- **App view**: a floating native tab bar built from the site's own menu. Cookie banners, ads and pop-ups are removed, sticky headers are kept out of the way, and the typography is modernised.
- **Stay-here shield**: blocks pop-up windows and spam redirects to other sites.
- **Local AI (Llama via Ollama, free, optional)**: a summary of each page, a safety check (safe / caution / risky), AI-picked tabs, and "ask about this page".

## Tech stack

- [Expo](https://expo.dev) SDK 58 / React Native 0.88 / React 19
- `react-native-webview` for page rendering, with injected scripts for restyling
- AsyncStorage for on-device storage (saved apps, history, settings)
- Jest + `jest-expo` + React Native Testing Library for tests
- [Ollama](https://ollama.com) (optional) for local AI features

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Git](https://git-scm.com) | any | to clone the repo |
| [Node.js](https://nodejs.org) | **LTS (20 or 22)** | npm comes with it |
| **Expo Go** app | latest | on your iPhone ([App Store](https://apps.apple.com/app/expo-go/id982107779)) or Android phone ([Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)) |
| [Ollama](https://ollama.com) | optional | only needed for the AI features |

You don't need Xcode or Android Studio to run the app in Expo Go.

---

## Quick start

### 1. Clone the repository

```bash
git clone https://github.com/senarkadp/webskin.git
```

```bash
cd webskin/mobile
```

All app code lives in the `mobile/` folder. Run every command below from there.

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npx expo start
```

The terminal prints a QR code.

### 4. Open the app on your phone

- **iPhone**: open the Camera app, scan the QR code and tap the banner to open it in Expo Go.
- **Android**: open Expo Go and tap **Scan QR code**.

Your phone and computer must be on the **same Wi-Fi network**. If they aren't, or the connection fails (for example on office or university Wi-Fi), start the server with a tunnel instead:

```bash
npx expo start --tunnel
```

### Other ways to run it

| Command | What it does |
|---------|--------------|
| `npm start` | same as `npx expo start` |
| `npm run android` | opens on a connected Android device or emulator |
| `npm run ios` | opens in the iOS Simulator (macOS with Xcode only) |
| `npm run web` | opens in the browser (limited, since WebView is a native component) |

In the running Expo terminal, press `r` to reload the app and `j` to open the debugger.

---

## Use it without your laptop (EAS Update + GitHub Actions)

`npx expo start` only works while your computer is running. To use WebSkin from anywhere, the app is published to Expo's servers as an **EAS Update**. A GitHub Actions workflow ([.github/workflows/eas-update.yml](.github/workflows/eas-update.yml)) runs the tests and publishes a new update every time you push to `main`.

> **iOS note:** Expo's docs don't say whether Expo Go on iOS can open published updates. If it can't, the reliable iPhone path needs a paid Apple Developer account ($99/year) and an EAS build (see "Installing as a real iOS app" below). On Android, a free installable APK works.

### One-time setup (on your computer)

1. Create a free account at [expo.dev](https://expo.dev/signup).
2. From the `mobile/` folder, log in and link the project. The second command writes `extra.eas.projectId` into `app.json`. The third writes `updates.url` and `runtimeVersion`.
   ```bash
   npx eas-cli login
   ```
   ```bash
   npx eas-cli init
   ```
   ```bash
   npx eas-cli update:configure
   ```
3. Commit and push the updated `app.json`.
4. Create an access token at [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens).
5. On GitHub, go to **repo Settings → Secrets and variables → Actions → New repository secret**. Name it `EXPO_TOKEN` and paste the token.
6. Push to `main`, or run the workflow by hand from the **Actions** tab ("Publish EAS Update" → **Run workflow**).

### Opening it on your phone

1. Sign in to **Expo Go** on your phone with the same Expo account.
2. Open your project on [expo.dev](https://expo.dev), go to **Updates**, pick the latest update on the `main` branch, and scan its QR code with your phone (or find the project under your account in Expo Go).

Your laptop can now be off. Each push to `main` publishes a new version, and the app picks it up the next time it opens.

### Installing as a real iOS app (paid Apple account)

If Expo Go can't open the update, build a standalone app. `eas.json` already has the build profiles.

```bash
npx eas-cli build --platform ios --profile production --auto-submit
```

This builds in the cloud (no Mac needed) and sends the app to TestFlight. Install the **TestFlight** app on your iPhone to get it. The app downloads new updates from the same GitHub Actions workflow automatically. For a free Android install, run `npx eas-cli build --platform android --profile preview` and open the APK link on your phone.

### AI features away from home

The AI features use Ollama on your computer, so they only work while that computer is on and reachable. Everything else (app view, pop-up shield, saved sites) works anywhere.

---

## Optional: set up the local AI

The app works without AI. To turn on page summaries, safety checks and "ask about this page", run Ollama on your computer and point the app at it.

1. Install [Ollama](https://ollama.com).
2. Download the model:
   ```bash
   ollama pull llama3.2:3b
   ```
3. Let your phone reach Ollama over Wi-Fi by making it listen on all network interfaces:
   - **Windows (PowerShell)**: run `setx OLLAMA_HOST 0.0.0.0`, then quit Ollama from the system tray and start it again.
   - **macOS**: run `launchctl setenv OLLAMA_HOST 0.0.0.0`, then restart the Ollama app.
   - **Linux**: run `OLLAMA_HOST=0.0.0.0 ollama serve`.
4. Find your computer's local IP address: `ipconfig` on Windows (the "IPv4 Address" line), `ipconfig getifaddr en0` on macOS, or `hostname -I` on Linux.
5. In the app, open **Settings**, enter `http://YOUR-IP:11434` (for example `http://192.168.1.10:11434`), tap **Test connection**, and pick your model.

If the connection test fails, check that your firewall allows incoming connections on port **11434**.

---

## Running the tests

```bash
cd mobile
```

```bash
npm test
```

The suite (5 files, 85 tests) runs in Node with mocks for the WebView and native storage, so no phone or emulator is needed.

---

## Project structure

```
webskin/
├── README.md
├── LICENSE
├── .github/workflows/
│   └── eas-update.yml               test + publish an EAS Update on push to main
└── mobile/                          Expo / React Native app
    ├── eas.json                     EAS build profiles and update channels
    ├── App.js                       app shell and screen switching
    ├── index.js                     entry point
    ├── app.json                     Expo config (name, icons, bundle ids)
    ├── appshell.js                  early tab-bar injection script (v0.1)
    ├── jest.setup.js                test mocks (WebView, AsyncStorage, safe area)
    ├── __tests__/                   Jest test suites
    ├── assets/                      icons and splash images
    └── src/
        ├── screens/
        │   ├── HomeScreen.js        search, saved apps, recents
        │   ├── BrowserScreen.js     WebView, App/Web toggle, tab bar, shield, AI panel
        │   └── SettingsScreen.js    AI and browsing settings
        ├── components/
        │   └── SearchBox.js         search box with Google suggestions
        ├── inject/
        │   └── skin.js              script injected into pages (extract, restyle, pop-up shield)
        ├── llm.js                   Ollama client (insights, ask, connection test)
        ├── search.js                URL helpers and suggestions
        ├── storage.js               saved apps, history, settings (on device)
        └── theme.js                 colours and styling tokens
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Phone can't connect to the dev server | Use the same Wi-Fi on both, or run `npx expo start --tunnel`. |
| "Project is incompatible with this version of Expo Go" | Update Expo Go from the app store. The project uses Expo SDK 58. |
| Dependency or version warnings | Run `npx expo install --fix`, then `npx expo-doctor`. |
| Strange bundler errors after pulling changes | Run `npx expo start --clear` to clear the Metro cache. |
| "Can't reach Ollama" in the app | Check that Ollama is running, `OLLAMA_HOST` is `0.0.0.0`, the IP address is right, and port 11434 is open in the firewall. |
| "Model ... isn't installed" | Run `ollama pull llama3.2:3b` (or the model you picked in Settings). |

---

## Roadmap

- Per-site AI "skin config" (elements to hide, colours) cached and reused
- Same-site check that understands public suffixes (for example `bbc.co.uk`)
- Ad and spam blocklists (EasyList)
- A free hosted Llama option for use away from your computer

## License

[MIT](LICENSE)
