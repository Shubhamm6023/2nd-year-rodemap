# Copilot instructions for CodePath

## Project overview

This repo is a static installable PWA and Android packaging project for a programming roadmap app. The app is intentionally framework-free: the main experience is a single HTML shell plus vanilla JavaScript in a small set of files.

- `index.html` renders the app shell, tabs, stats, search, footer, and empty states.
- `styles.css` contains the layout, theme system, responsive cards, toasts, and progress visuals.
- `js/data.js` is the curriculum source of truth: 8 sections, 92 topics, channels, and project feature text.
- `js/core.js` holds the pure logic that is safe to run in Node and browsers: filter/search logic, topic ids, progress math, backup serialization, and URL builders.
- `js/app.js` handles DOM rendering, user interactions, localStorage persistence, and theme/tab behavior.
- `sw.js` and `app.webmanifest` provide offline/PWA behavior; Android packaging is driven by `android/` and `tools/build-android.mjs`.

The app intentionally uses YouTube search URLs rather than fixed video IDs, so topic links stay valid even when creators rename or re-upload content.

## Build, test, and validation commands

This project does not use a framework build pipeline; the closest equivalents to lint/check are the script validation steps below.

```bash
# start the local dev server (PWA preview / static serving)
npm start
# or: npm run serve

# syntax + asset validation for the app shell, JS files, service worker, and Android packaging
npm run check

# core unit tests + curriculum validation
npm test

# UI tests that run the real index.html in jsdom
npm run test:ui

# full project validation
npm run test:all

# generate the app icon assets
npm run icons

# validate Android project and build the APK
npm run android
npm run android:build
```

For a single test, use Node's test runner directly:

```bash
# single file
node --test tools/core.test.cjs
node --test tools/ui.test.cjs

# one named test case within a file
node --test --test-name-pattern="searchUrl builds a valid YouTube search link" tools/core.test.cjs
node --test --test-name-pattern="renders every section tab and every topic card" tools/ui.test.cjs
```

`npm run check` is effectively the repo's validation/lint equivalent:

- it checks `js/data.js`, `js/core.js`, `js/app.js`, `sw.js`, and the build scripts with `node --check`
- it runs `tools/check-assets.mjs` to verify asset references and manifest wiring
- it runs `tools/check-android.mjs` to validate the Android packaging setup

## High-level architecture and workflow

The big picture is a data-first curriculum app:

1. `js/data.js` defines every section/topic with fields like `t`, `d`, `q`, `ch`, and optional `f`.
2. `js/core.js` turns that data into filtered views, search results, progress maps, and YouTube URLs. Its functions are intentionally DOM-free so they can be tested in Node.
3. `js/app.js` reads the curriculum, binds UI events, renders tabs/cards, manages `localStorage`, and coordinates the "done" and "favourites" states.
4. `sw.js` and `app.webmanifest` allow offline installation and a home-screen app experience.
5. `tools/*.test.cjs` validate the curriculum and the real browser rendering flow; `tools/validate-data.mjs` fails the build if IDs, URLs, or data integrity are broken.
6. The Android release path is separate from the browser app, but it reuses the same static assets and runs a packaged build via the scripts under `tools/`.

When changing the app, prefer preserving the existing vanilla JS structure instead of introducing a framework or modules unless the repo explicitly opts into them.

## Key conventions and repo-specific patterns

- Keep the curriculum data normalized in `js/data.js`; do not duplicate topic metadata in the UI layer.
- Preserve the unique topic key pattern `section.id + '::' + topic.t` used throughout the app for progress bookkeeping and imports/exports.
- Treat `js/core.js` as the contract layer for progress/search logic; functions there should remain side-effect free and browser-agnostic.
- The app stores user state in browser `localStorage` under:
  - `codepath:done`
  - `codepath:bookmarks`
  - `codepath:theme`
- The repo treats data integrity as product-critical: topic titles, section IDs, URLs, and channel lists must remain valid and semantically consistent.
- Search is query-based and intentionally case-insensitive; queries are split into words and every word must match.
- App behavior should still work with `file://` loading, even though `npm start` is the recommended way to get PWA/install features.
- Release flow is tag-based; the workflow in `.github/workflows/release.yml` runs `npm run test:all` before building and attaching the APK.

## Working in this repo

- Prefer small, surgical edits to the static assets and script files already present.
- When adding a new topic, follow the existing object shape in `js/data.js` and run `npm test` afterward.
- If a change affects the curriculum, also validate the app with the relevant UI or data checks rather than assuming the browser code is unaffected.
- Keep changes compatible with the plain browser + Node environment; avoid browser-only or server-only assumptions unless the code is explicitly in a tooling script.
