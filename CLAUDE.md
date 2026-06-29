# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node version is pinned in `.nvmrc` (20.10.0).

- `npm start` — run the Create React App dev server.
- `npm run build` — production build into `build/`.
- `npm test` — run the CRA/Jest test runner (watch mode). Run a single test with `npm test -- src/App.test.js` or filter by name with `-t "<pattern>"`.
- `npm run generatePlaylist` — regenerate `playlist.json` from the upstream iptv-org API (runs `playlistGenerator.js` in Node, not in the browser).
- `npm run deploy` — build and publish `build/` to GitHub Pages via `gh-pages` (`predeploy` runs the build first).

## Architecture

This is a Create React App SPA that browses and plays public IPTV streams, deployed to GitHub Pages (`homepage` in `package.json`).

### Two distinct "playlist" paths — do not confuse them

1. **Build-time generation** (`playlistGenerator.js`, repo root, Node only): fetches `streams.json` + `channels.json` from `iptv-org.github.io`, joins streams to channel metadata, derives the deduped `countries` and `categories` lists, and writes the committed `playlist.json` (`{ channels, countries, categories }`). This is run on a weekly cron by `.github/workflows/playlist-update.yml`, which opens an automated PR with the refreshed file. The `country-list` dependency and quirks like the `UK→GB` and `XK→Kosovo` overrides live here.
2. **Runtime fetch** (`src/helpers/playlistParser.js`, browser): fetches the committed `playlist.json` over raw GitHub (`raw.githubusercontent.com/.../master/playlist.json`) — it does NOT hit the iptv-org API. `App.js` calls this once on mount and loads the result into context.

Because countries/categories are precomputed in `playlist.json`, the in-app derivation helpers `src/helpers/countryHelper.js` and `src/helpers/groupHelper.js` are largely legacy; prefer the lists already in state.

### State

Single app-wide React Context (`src/providers/appWide/`): `provider.js` holds `channels`, `countries`, `categories`, `showSplashScreen` in `useState`; consume via the `useAppWide()` hook, which returns `{ state, actions }`. There is no Redux or external store. The splash screen shows until the playlist load completes.

### Routing

Uses `createHashRouter` (HashRouter) — required for GitHub Pages static hosting. Routes are defined inline in `src/App.js`: `/`, `/search`, `/categories`, `/countries`, `/channels`, `/tvplayer`. Navigation between filtered views is done via query params, not path params:
- `/channels?country=<CODE>` or `/channels?category=<NAME>` (`Channels.js` reads these and filters the in-memory channel list).
- `/tvplayer?channelId=<id>` (`Player.js` looks the channel up by id).

### Playback

`src/components/VideoJS.js` wraps video.js. Streams are HLS (`type: 'application/x-mpegURL'`). The wrapper manages player lifecycle through refs and disposes the player on unmount.

### Layout / UI

Screens live in `src/screens/`, reusable pieces in `src/components/` (most screens render inside `Wrapper`, which provides the `AppBar`). Horizontal carousels use `react-horizontal-scrolling-menu` with the custom `LeftArrowOfScroll`/`RightArrowOfScroll` components. Styling is a mix of `styled-components` (`src/styledComponents/`) and inline styles. Firebase is initialized in `App.js` for Analytics only.

## Notes

- The committed `playlist.json` is large (multi-MB) and machine-generated — regenerate it with `npm run generatePlaylist` rather than hand-editing.
- The Firebase config in `App.js` is a public web client config (analytics), not a secret.
