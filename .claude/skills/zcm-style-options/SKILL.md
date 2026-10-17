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
  unused ones, which is how 24 of v3.1's disappeared. The icon styles'
  own SVGs are the exception (below).
- **Restored icons are laid out and colored by force**: one gutter (inset,
  16px icon, gap) on every platform but macOS, whatever padding a theme
  gives items or labels, and `fill: var(--calmer-icon-fill)`, which the
  script sets per menu from the computed color of its labels, at full
  opacity. Themes that color labels but not items otherwise get black
  icons.

## Icon styles

`uc.fixcontext.iconpack` (a string: `zen`, `fluent`, `zenui`; a
`"dropdown"` in `preferences.json` with `"placeholder": false`) picks the
icons of "Icons for every option" and the quick actions. Zen's are
`chrome.css`'s. Fluent and ZenUI come from Context Menu Icons by
Starry-AXQG (MIT; keep `context-menu/icons/LICENSE` and the README credit):

- `context-menu/icons/packs.json` maps each Zen icon `chrome.css` uses to
  the pack's file, plus per-item overrides (`items`, keyed by the selector
  as written in `chrome.css`, on one line). `<pack>/` holds only the SVGs
  it uses, each drawn with `context-fill`.
- `node scripts/build_icon_packs.mjs` writes `<pack>.css`: every icon rule
  of the restoreicons block under `:root` (so it beats `chrome.css`) inside
  `@media -moz-pref("uc.fixcontext.iconpack", "<pack>")`, with Zen's icon
  where the pack has none. Run it after changing either file;
  `tests/icon_packs.test.mjs` fails until you do. Prettier skips them.
- The script loads them as `data:` user sheets with **absolute** icon
  URLs: an `url()` inside a custom property is resolved against the sheet
  that uses the variable (`chrome.css`), and an SVG only gets
  `context-fill` from a `chrome://` or `resource://` address.
- An item whose own pack icon replaces a mirrored Zen one (Redo uses Undo's)
  gets `transform: none`.

## Options the script helps

- **Quick actions** (`uc.fixcontext.tabactions`): the script moves Reload,
  Pin/Unpin, Add to/Remove from Essentials and Bookmark into
  `#calmer-tab-actions` (a `menugroup`, like `#context-navigation`) while
  the tab menu is open; `chrome.css` styles it and sets their icons for
  when restoreicons is off. "No icons" must keep excluding it.
- **Hide unavailable options** (`uc.hidecontext.disabled`) hides
  `[disabled]` items in the menus of `MENUS` (a test keeps the list in
  sync). The script retidies separators (its observer watches `disabled`);
  for CSS-only installs, the rule hiding `#context-sep-redo` covers the one
  separator `check_menus.mjs` found out of place.
- **macOS** native menus can't be styled, hence the first option; they do
  honor `hidden`, so the item list works there either way.
