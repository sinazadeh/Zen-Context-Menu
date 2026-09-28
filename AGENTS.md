# Repository guidance

## Project and runtime

Zen Context Menu is a CSS-only mod for [Zen Browser](https://zen-browser.app)
that hides context menu options, reorders the tab context menu, restores menu
icons and can tint menus with the current space's colors. It's a fork of
KiKaraage's mod from the Zen theme store
([source](https://github.com/zen-browser/theme-store/tree/main/themes/81fcd6b3-f014-4796-988f-6c3cb3874db8),
[author's repository](https://github.com/KiKaraage/ZenMods)); keep the credit
in `README.md`, `LICENSE` and the `chrome.css` header.

There is no build step and no JavaScript in the mod. Users install it with
[Sine](https://github.com/CosmoCreeper/Sine) (which reads `theme.json`) or by
importing `chrome.css` from `userChrome.css`. Every option is a boolean
preference that `chrome.css` reads with `@media -moz-pref("...")`.

Read `README.md` for features and installation before changing behavior.

## Code map

| Location                             | Responsibility                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `chrome.css`                         | The mod. One `@media -moz-pref()` block per option.                                                  |
| `preferences.json`                   | The options (Zen theme store format), shown by Sine's and Zen's mod managers.                        |
| `theme.json`                         | Sine manifest: points at `chrome.css`, `preferences.json` and `README.md`.                           |
| `image.png`                          | Preview image (KiKaraage's, from the theme store).                                                   |
| `scripts/css_targets.mjs`            | Pure helpers: read prefs, ids, classes and icon URLs from CSS and browser sources; separator lint.   |
| `scripts/check_selector_targets.mjs` | Checks every id, class and icon `chrome.css` uses against current Zen and Firefox sources (network). |
| `scripts/check_menus.mjs`            | Opens the real menus in a downloaded Zen, with each option on, and checks what they show.            |
| `scripts/menu_scenarios.mjs`         | The menus `check_menus.mjs` opens (tab, pinned tab, link, image, text field...) and how.             |
| `scripts/marionette.mjs`             | Minimal client for Marionette, the automation protocol built into Zen.                               |
| `scripts/zen_release.mjs`            | Finds and downloads Zen releases.                                                                    |
| `tests/`                             | Node unit tests: helpers, `preferences.json` ↔ `chrome.css` consistency, CSS conventions.            |
| `.github/workflows/`                 | Tests, Prettier, ESLint, and the weekly selector and menu checks.                                    |

## Implementation conventions

- Match menu items by `id` (or `class` when the browser gives no id).
  **Never** use `:nth-child()` or other position-based selectors: Zen and
  Firefox add and move items between releases, and v3.1's positional
  selectors ended up hiding "Duplicate Tab" and "Move Tab". Separators without
  an id can be matched through their neighbors, e.g.
  `menuseparator:has(+ #context_zen-add-domain-to-routing)` or
  `#context_zen-edit-tab-icon + menuseparator`. `tests/chrome_css.test.mjs`
  rejects `:nth-child()`.
- Zen and Sine load mods as a **user** style sheet, which loses to the
  browser's own (author) styles unless a declaration is `!important`. Use
  `!important` on everything that overrides browser styles; the tests require
  it for `display` and `order`.
- Put every rule inside the `@media -moz-pref("...")` block of the option it
  belongs to. The mod must not change anything the user didn't turn on (the
  tests check this too).
- Keep one block per option, with a short comment naming the menu items it
  affects by their visible labels.
- Follow Prettier's formatting (2 spaces, double quotes).
- Keep edits focused: `chrome.css` is what users read when something breaks.

## Changing options

To add an option:

1. Add a `@media -moz-pref("uc.hidecontext.<name>")` block to `chrome.css`
   (`uc.fixcontext.*` for options that change rather than hide things).
2. Add it to `preferences.json` with `"type": "checkbox"` and a label in the
   style of its neighbors: emojis for the menus it affects (📑 tab, 🌐 page,
   🔤 selected text, 🔗 link, 🖼️ image, 🎵 📺 media, ⌨️ text field), then what it
   does.
3. If it's on by default, give it `"defaultValue": true` (a boolean, never the
   string `"true"`) and end the label with "(enabled by default)".
   `tests/preferences.test.mjs` checks all of this, and that every option is
   used by `chrome.css` and vice versa: upstream v3.1 shipped three options
   that did nothing because the names didn't match.
4. Update the list in `README.md` and add a `CHANGELOG.md` entry.

**Never rename an existing preference.** The names are shared with the theme
store version, so people switching to this fork keep their settings.

## Invariants and sensitive areas

- **The tab context menu is rearranged at runtime.** Firefox 156's
  `TabContextMenu.MENU_SECTIONS` moves items into sections the first time the
  menu opens (and differently when
  `browser.tabs.contextmenu.altstructure.enabled` is on), and Zen inserts its
  own items from several modules (`ZenPinnedTabManager`, `ZenViewSplitter`,
  `ZenFolders`, `ZenSpaceRoutingManager`, ...). The markup in
  `main-popupset.inc.xhtml` is not the order users see, which is another
  reason to match by id. The reorder option
  (`uc.fixcontext.ergonomicsfortabs`) moves items with `order` into four
  groups and moves one of the menu's own separators to each group's edge: a
  separator that comes after every item of its group in the DOM can close the
  group, one that comes before all of them can open it. Separators that would
  end up next to another one are hidden. Check the result in a real browser
  (see "Manual browser validation") for a regular tab, a pinned tab and with
  several tabs selected.
- **Move Tab holds the space list.** Zen 1.22 fills `#moveTabOptionsMenu`
  with "move to <space>" items (`ZenSpaceManager.updateWorkspacesChangeContextMenu`).
  Hiding `#context_moveTabOptions` leaves no way to move a tab to another
  space from the menu, so it must stay visible by default.
- **Firefox hides separators itself, but only based on the DOM.**
  `showHideSeparators` looks at the `hidden` attribute of neighbors, not at
  CSS. An item hidden by this mod can leave two separators next to each other,
  or one at the top or bottom. When hiding the last item of a group, hide its
  separator too, but only if nothing else relies on it: `#frame-sep` is also
  the separator above the Inspect items when there's no frame, which is why
  the frame option hides the separator after "This Frame" instead, and the
  search option only hides `#frame-sep` when there's no frame.
- **Firefox never sets `disabled="false"`.** It adds or removes the
  attribute (`nsContextMenu.setItemAttr`). Test `[disabled]` /
  `:not([disabled])`, as the "Copy Clean Link" option does; upstream's
  `[disabled="false"]` never matched.
- **Space colors.** Zen sets `--zen-primary-color` on `:root`, so menus can
  use it, but it sets the gradient (`--zen-main-browser-background`) on
  `#zen-browser-background` only. The gradient option paints that element into
  menus with `-moz-element(#zen-browser-background)`, with
  `--arrowpanel-background` underneath for windows that don't have it
  (Library, dialogs). Menus and panels take their background from
  `--panel-background-color` (Firefox renamed it from `--panel-background`),
  which Firefox also copies into `--background-color-canvas` for controls
  inside panels, so that one is reset to a plain color.
- **Restored icons use the item's own icon slot.** Firefox 156 menu items have
  a `.menu-icon` `<img>` before the label. The restore option sets
  `content: var(--menu-image)` on it for items without an icon of their own,
  so the label moves over by itself. Two details matter:
  - `--menu-image` is reset on every `menu`/`menuitem` (with `:where()`, so
    any id rule wins); otherwise custom properties inherit and every item of a
    submenu would show the submenu's icon.
  - Items without an icon get an empty SVG instead of nothing, so their slot
    keeps them aligned without Firefox's broken-image border.
- **Only use icons that ship with Zen or Firefox:**
  `chrome://browser/skin/zen-icons/*` (listed in Zen's
  `src/browser/themes/shared/zen-icons/jar.inc.mn`, the same names on every
  platform), `chrome://browser/skin/*` and `chrome://global/skin/icons/*`. Zen
  deletes icons it no longer uses, which is how 24 of v3.1's icons
  disappeared; `scripts/check_selector_targets.mjs` checks them all.
- **macOS** uses native context menus (`widget.macos.native-context-menus`),
  which CSS can't style; that's why it's the first option.
- **Sine specifics:**
  - Sine offers an update when `updatedAt` in `theme.json` is newer than the
    installed copy's, so bump it (and `version`) with every release.
  - Sine applies `defaultValue`s only when the mod's settings are first shown,
    so default-on options stay off until then (README says so). Zen's own mod
    manager applies them when it loads the mod.
  - Sine treats a repository with more than one `theme.json` as a collection
    of mods, and picks `chrome.css` and `preferences.json` by file name.
    Don't add other files with those names (test fixtures included).
  - `theme.json`'s `id` is deliberately not the theme store's UUID, so a
    store copy of the mod and this fork never overwrite each other.

## Keeping up with Zen

When Zen or Firefox moves or renames something, an option silently stops
working. Two weekly workflows watch for that:

- **Selector targets** (`scripts/check_selector_targets.mjs`) lists every id,
  class or icon `chrome.css` uses that the latest Zen release (or Zen's `dev`
  branch) and its Firefox version no longer define.
- **Menus** (`scripts/check_menus.mjs`) opens the menus in the latest Zen
  release with no option on, the defaults, and each option on (alone and
  with the defaults). It fails when a menu has a separator at its top or
  bottom or two in a row, when an option hides nothing although its items
  are showing, when it hides or shows anything outside its own block of
  `chrome.css`, when the defaults lose Duplicate Tab, Move Tab or the other
  spaces, when Copy Link / Copy Clean Link don't swap, or when restored icons
  don't line up. It only covers the menus in `menu_scenarios.mjs`; options
  whose items don't appear there (video, frames, sync...) are listed as not
  exercised.

To fix a failure:

1. Run the failing check locally: `node scripts/check_selector_targets.mjs release dev`,
   or `node scripts/check_menus.mjs --only=<option>` (Linux; add
   `MOZ_HEADLESS=1` without a display).
2. Find where the item went: search Zen's source
   (`git clone --depth 1 https://github.com/zen-browser/desktop`, then
   `grep -rn "<old id>" src/`) and Firefox's
   (`browser/base/content/browser-context.inc.xhtml`,
   `main-popupset.inc.xhtml`, `browser/components/tabbrowser/content/tab-context-menu.js`).
   In a running browser, the Browser Toolbox (`Ctrl+Shift+Alt+I`) with
   "Disable popup auto-hide" shows a menu's real items and ids.
3. Items neither check can see need the manual checks below.

## Static checks

Install the tools ad hoc (the repository has no `package.json` on purpose):

```sh
npm install --no-save --package-lock=false eslint@9.7.0 @eslint/js@9.7.0 globals@15 prettier@3.9.9
```

Then run:

```sh
node --test "tests/*.test.mjs"
npx prettier --check "**/*.{css,mjs,md,json,yml}"
npx eslint .
git diff --check
```

and, when `chrome.css` changed (both need git and network access; the second
downloads Zen for Linux into `.cache/` and runs it headless):

```sh
node scripts/check_selector_targets.mjs release dev
MOZ_HEADLESS=1 node scripts/check_menus.mjs
```

## Manual browser validation

`check_menus.mjs` covers the common menus on Linux, but not how they look,
other platforms, or menus it doesn't open. For changes to `chrome.css`, check
the affected menus in Zen with the option on and off:

- Tab context menu: regular tab, pinned tab, Essential, several selected tabs,
  and a tab in a split view. Check the Move Tab submenu lists your other
  spaces.
- Page context menu on a link (one with `?utm_source=...` and one without),
  an image, a video, selected text, a text field, and an empty page area.
- Toolbar, bookmark and space (workspace) context menus when changing icons
  or colors.
- No two separators next to each other, and none at the top or bottom.
- With restored icons: labels line up, and submenus don't repeat their
  parent's icon.

Record the Zen version (`about:support`), OS and what you checked in the pull
request.
