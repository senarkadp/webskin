# webskin
Creating an app view for any web UI so users can interact smoothly without popup issues or unnecessary ads — dynamically making any website more visually satisfying.

**WebSkin turns any website into a clean, safe app — even sites that never built one.**

## Features (v0.2)
- **Home screen** — search Google or type a site, with live search suggestions; saved sites appear as app icons; recent sites
- **App / Web toggle** — switch any site between the WebSkin app view and the original site (remembered per site)
- **App view** — floating native tab bar built from the site's menu, cookie banners/ads/pop-ups removed, sticky headers tamed, modern typography
- **Stay-here shield** — blocks pop-up windows and spam redirects to other sites
- **Local AI (Llama via Ollama, free)** — per-page summary, safety check (safe / caution / risky), AI-picked tabs, and "ask about this page"

## Run it on your iPhone
1. Install [Node.js LTS](https://nodejs.org) and the **Expo Go** app on your iPhone.
2. ```
   cd mobile
   npm install
   npx expo start
   ```
3. Open the project in Expo Go (same Wi‑Fi, or `npx expo start --tunnel`).

## Set up the local AI (free)
1. Install [Ollama](https://ollama.com) on your laptop.
2. `ollama pull llama3.2:3b`
3. Let your phone reach it (Windows PowerShell): `setx OLLAMA_HOST 0.0.0.0`, then quit and restart Ollama.
4. `ipconfig` → note your IPv4 address.
5. In WebSkin → Settings, enter `http://YOUR-IP:11434`, tap **Test connection**, pick your model.

## Project structure
```
mobile/
  App.js                       app shell + screen switching
  src/screens/HomeScreen.js    search, saved apps, recents
  src/screens/BrowserScreen.js WebView, App/Web toggle, tab bar, shield, AI panel
  src/screens/SettingsScreen.js AI + browsing settings
  src/components/SearchBox.js  search with Google suggestions
  src/inject/skin.js           script injected into pages (extract + restyle + pop-up shield)
  src/llm.js                   Ollama client (insights, ask, connection test)
  src/search.js                URL helpers + suggestions
  src/storage.js               saved apps, history, settings (on-device)
```

## Roadmap
- Per-site AI "skin config" (elements to hide, colours) cached and reused
- Public-suffix-aware same-site check (bbc.co.uk)
- Ad/spam blocklists (EasyList)
- Free hosted Llama option for use away from the laptop
