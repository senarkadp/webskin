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
└── mobile/                          Expo / React Native app
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
