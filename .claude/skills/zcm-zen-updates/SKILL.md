---
name: zcm-zen-updates
description: Keeping Zen Calmer Context Menu working when Zen or Firefox changes - the weekly selector-target and menu checks, what their failures mean, and how to find where an item went. Use when a Selector targets or Menus workflow run fails, when an item or option stops working after a Zen update, or when Zen moves to a new Firefox version.
---

# Keeping up with Zen

When Zen or Firefox moves or renames something, an option silently stops
working, or an item hidden by its old key shows up again. Two weekly
workflows watch for that:

- **Selector targets** (`scripts/check_selector_targets.mjs`) lists every id,
  class or icon `chrome.css` uses, and every menu in `menus.js`, that the
  latest Zen release (or Zen's `dev` branch) and its Firefox version no
  longer define. It downloads Zen's sources with git and Firefox's files
  from `raw.githubusercontent.com` at the `FIREFOX_<version>_RELEASE` tag in
  Zen's `surfer.json`. When Firefox deletes one of the files it lists
  (`FIREFOX_SOURCES`), the whole check fails: find where the ids moved and
  update the list (Firefox 158 removed `moz-input-box.js`;
  `.textbox-contextmenu` lives in `editMenuOverlay.js`;
  `.webextension-menuitem` is set in `ext-menus.js`). The ids of what
  `context-menu.uc.js` adds (`calmer-*`) count as defined.
- **Menus** (`scripts/check_menus.mjs`) downloads the latest Zen for Linux,
  opens the menus in `menu_scenarios.mjs` with no option on, the defaults,
  and each option on, then loads `context-menu.uc.js` and hides
  `HIDDEN_ITEMS`. It fails on a separator at a menu's top or bottom or two in
  a row, an option hiding nothing although its items show, hiding or
  showing anything outside its own block, the defaults losing Duplicate
  Tab, Move Tab or the other spaces, Copy Link / Copy Clean Link not
  swapping, restored icons out of line, a hidden item showing, an item
  staying hidden once the list is cleared, an old option not migrated, or a
  script error. It runs the on/off options only ("Hide unavailable options"
  may hide any item that's greyed out); the icon style is a dropdown, whose
  sheets the unit tests check, and the quick actions and "More options" need
  the probes in `zcm-browser-validation`.

## Fixing a failure

1. Run it locally: `node scripts/check_selector_targets.mjs release dev`, or
   `MOZ_HEADLESS=1 node scripts/check_menus.mjs [--only=<option>]` (Linux).
2. Find where the item went: clone Zen
   (`git clone --depth 1 https://github.com/zen-browser/desktop`) and
   `grep -rn "<old id>" src/`; for Firefox, start with
   `browser/base/content/browser-context.inc.xhtml`,
   `main-popupset.inc.xhtml` and
   `browser/components/tabbrowser/content/tab-context-menu.js`. In a running
   browser, the Browser Toolbox (`Ctrl+Shift+Alt+I`) with "Disable popup
   auto-hide" shows a menu's real items.
3. An id gone from `chrome.css`'s icons: drop it or point it at the new id,
   in `context-menu/icons/packs.json`'s `items` too if it's there (the
   tests flag a key with no rule), then run
   `node scripts/build_icon_packs.mjs`. A quick action's id
   (`TAB_ACTIONS` in the script, and its icon in the quick actions block)
   moves the same way.
   A renamed item a user had hidden comes back; the settings page lists the
   new one, so there's nothing to migrate unless the old id is in
   `LEGACY_PREFS`. Update `ALIASES`, `LABELS` and the page menu's `sections`
   in `menus.js` so the item keeps its switch and its place.
4. Items neither check can see need the manual checks in
   `zcm-browser-validation`.
