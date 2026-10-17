---
name: zcm-loader
description: How Sine and fx-autoconfig load Zen Context Menu Enhanced - theme.json, chrome:// paths, loading the script again or unloading it live, default prefs, the Sine gear-button hook and the one-mod-per-repository rule. Use when touching theme.json, the start or end of context-menu.uc.js, how it finds its own files, or when debugging "installed but nothing happens".
---

# Loaders

## Sine

- Sine downloads the whole repository (a zip of the default branch) into
  `chrome/sine-mods/<id>/` and serves it at `chrome://sine/content/<id>/`.
  `theme.json`'s `id` is `zen-context-menu`; it's deliberately not the theme
  store's UUID, so a store copy and this fork never overwrite each other.
- The `id` stayed `zen-context-menu` when the mod became Zen Context Menu
  Enhanced (repository `sinazadeh/zen-context-menu-enhanced`). Sine keeps an
  installed mod's `id` across updates and only new installs read it from
  `theme.json`, so changing it would split users between two ids, and
  `SINE_MOD_ID` in the script (the gear-button hook) can only match one.
  Keep it, and `zen-context-menu.json`, with their old names.
- It loads `chrome.css` as a user style sheet and runs the `.uc.js` files in
  `scripts` on each matching window's `load` event
  (`loadSubScriptWithOptions`). Scripts from a repository only run with
  "Enable installing JS from unofficial sources" on (`sine.allow-unsafe-js`);
  without it only the style options work.
- Sine picks `chrome.css` and `preferences.json` by file name and treats a
  repository with more than one `theme.json` as a collection of mods. Don't
  add other files with those names; `tests/theme.test.mjs` checks.
- Sine offers an update when `updatedAt` is newer than the installed
  copy's, so bump it (and `version`) with every release (`zcm-release`).
- Sine applies `preferences.json`'s `defaultValue`s only when its options
  box is first opened; the script sets `DEFAULT_ON` prefs on the default
  branch instead, so they apply at once and vanish with the mod.

## Live unload

`theme.json` has `"supportsUnload": true`. The script passes `unload` to
`window.addUnloadListener` (Sine keys it by the caller's file name), and
Sine calls it when the mod is switched off, updated or removed, then loads
the script again if needed. `unload()` must undo everything `init()` did:
window listeners, the prefs observer, the progress listener and hooked
settings pages, hidden items in open menus (`restore`), and the
"Customize Context Menus…" item. The script also unloads a previous copy in
the same window before starting, in case it's loaded twice.

## Finding its own files

`SCRIPT_URL` comes from `Components.stack.filename` (the last part after
" -> "), and `menus.js`, the settings page and `chrome.css` are resolved
next to it. That works for `chrome://sine/content/zen-context-menu/` and for
fx-autoconfig's `chrome://userchromejs/content/` alike, as long as the
`context-menu` folder sits next to the script. `loadSubScript` refuses
`file://` URLs: always load from a chrome:// package.

## Opening the settings

- "Customize Context Menus…" goes after "Customize Toolbar…" in
  `#toolbar-context-menu` (right-click the sidebar's empty space).
- The gear button on the mod's card in Sine (`.sineItemConfigureButton`
  inside `.sineItem[mod-id="zen-context-menu"]`, in about:preferences)
  opens the page instead of Sine's options box; the script hooks every
  about:preferences/about:settings page through a tabs progress listener.

## fx-autoconfig

`context-menu.uc.js` and the `context-menu` folder go in `chrome/JS/`;
`chrome.css` goes in `chrome/` and is imported from `userChrome.css`. The
settings page then has no `chrome.css` next to the script to read icons
from and shows rows without them; nothing else changes.
