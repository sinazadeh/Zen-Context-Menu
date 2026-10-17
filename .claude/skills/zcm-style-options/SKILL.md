---
name: zcm-style-options
description: Rules for chrome.css, the style options (reorder the tab menu, icons, separators, space colors, one Copy Link option) - matching by id, !important, one -moz-pref block per option, and the invariants behind each option. Use when changing chrome.css or preferences.json, or adding or changing a style option.
---

# The style options (chrome.css)

Every option is a boolean preference read with `@media -moz-pref("...")` and
listed in `preferences.json` (Zen theme store format). Hiding single items
is the item list's job (`zcm-item-list`); don't add options for it.

## Conventions

- Match menu items by `id` (or `class` when the browser gives none).
  **Never** use `:nth-child()` or other position-based selectors: v3.1's
  ended up hiding "Duplicate Tab" and "Move Tab". Separators without an id
  can be matched through neighbors, e.g.
  `menuseparator:has(+ #context_zen-add-domain-to-routing)`.
- Zen and Sine load mods as a **user** style sheet, which loses to the
  browser's own styles unless a declaration is `!important`.
- Every rule goes inside its option's `@media -moz-pref()` block, one block
  per option with a comment naming the items by their visible labels. The
  mod must not change anything the user didn't turn on.
- `tests/chrome_css.test.mjs` checks all of the above.

## Adding an option

1. A `@media -moz-pref("uc.fixcontext.<name>")` block in `chrome.css`.
2. An entry in `preferences.json` (`"type": "checkbox"`, a label in the
   style of its neighbors) and in `OPTIONS` in `context-menu/settings.js`
   (title and one sentence). `tests/menus.test.mjs` checks the lists match.
3. On by default: `"defaultValue": true` (a boolean), "(enabled by
   default)" at the end of the label, and the pref in `DEFAULT_ON` in
   `menus.js`. The script sets those on the default branch at startup, since
   Sine applies `defaultValue`s only once its options box is opened.
4. README list and a `CHANGELOG.md` entry.

**Never rename a preference**: the names are shared with the theme store
version. The old "Hide ..." options live on only in `LEGACY_PREFS`.

## Invariants

- **The tab menu is rearranged at runtime.** Firefox's
  `TabContextMenu.MENU_SECTIONS` moves items the first time the menu opens
  (differently with `browser.tabs.contextmenu.altstructure.enabled`), and
  Zen inserts items from several modules. The reorder option moves items
  with `order` into four groups and moves one of the menu's own separators
  to each group's edge; separators that would end up next to another are
  hidden. Check a regular tab, a pinned tab and several selected tabs.
- **Move Tab holds the space list** (Zen fills `#moveTabOptionsMenu`), so
  it must stay visible by default.
- **Firefox never sets `disabled="false"`**; test `[disabled]` /
  `:not([disabled])`, as the Copy Clean Link option does.
- **CSS can't tell Firefox's separator logic an item is gone.** An option
  that hides items with CSS handles its own separators (the item list's
  tidy-up does too, but only in the menus it manages).
- **Space colors.** `--zen-primary-color` is on `:root`; the gradient is
  only on `#zen-browser-background`, painted into menus with
  `-moz-element()` over `--arrowpanel-background`. Menus use
  `--panel-background-color`, which Firefox copies into
  `--background-color-canvas`, so that one is reset to a plain color.
- **Restored icons use the item's own `.menu-icon` slot** via
  `content: var(--menu-image)`. `--menu-image` is reset on every
  `menu`/`menuitem` with `:where()` so submenus don't inherit their parent's
  icon, and items without one get an empty SVG to stay aligned. The settings
  page reads these rules too, so keep them `#id { --menu-image: url("…") }`.
- **Only icons that ship with Zen or Firefox** (`chrome://browser/skin/zen-icons/*`,
  `chrome://browser/skin/*`, `chrome://global/skin/icons/*`): Zen deletes
  unused ones, which is how 24 of v3.1's disappeared.
- **macOS** native menus can't be styled, hence the first option; they do
  honor `hidden`, so the item list works there either way.
