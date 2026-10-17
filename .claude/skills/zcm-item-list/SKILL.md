---
name: zcm-item-list
description: How the item list works - context-menu.uc.js hiding items as menus open, item keys, aliases and sections in context-menu/menus.js, what gets recorded for the settings page, and the settings page itself. Use when changing context-menu.uc.js, anything under context-menu/, how items are hidden, keyed, grouped or labelled, or the uc.hidecontext.items preference.
---

# The item list

`context-menu.uc.js` runs in every browser window. It hides the items whose
keys are in the string preference `uc.hidecontext.items` (a JSON array),
records what menus show, and gives the settings page
(`context-menu/settings.html`) its data through `window.ZenContextMenu`.
`context-menu/menus.js` holds what both share: the menus, sections, aliases,
labels, item keys and separator logic.

## Item keys

`itemKey` in `menus.js` makes them: `#<id>`, or for items without an id
their localization id, command or label within their menu
(`<menu>|l10n:…`). Keys are what users' choices are saved under, so **never
change how a key is built** for items that already have one, and never
rename `uc.hidecontext.items`.

Extensions' items are rebuilt each time a menu opens (Firefox's
`ext-menus.js`), with ids made of the extension's widget id
(`widgetId()`) and the item's. Items an extension didn't name get a number
that changes every session, and so does the submenu holding an extension's
items when it has several: those are `ext:<widget>|<label>` and
`ext:<widget>`.

`ALIASES` maps an item to the one whose switch it follows ("Unpin Tab" →
"Pin Tab", "Reload Tabs" → "Reload Tab"); no chains. `LABELS` names items
whose label quotes what was right-clicked or that have none. `MODS` tags
mods' items by id: ask mod authors for ids (Tab Groups and Second Sidebar
have them).

## Hiding

- Use the `hidden` attribute, never CSS: Firefox's separator logic and
  macOS's native menus only see the DOM.
- The `popupshowing` listener is on the window, so it runs after the menu's
  own listeners (Firefox's inline handlers, Zen's, other mods').
- Only hide items that are showing; remember them per popup and show them
  again on `popuphidden`, so whoever manages an item finds it as they left
  it. A `MutationObserver` re-applies when items are added or shown while
  the menu is open, gives back items someone else shows or hides, and stops
  after 20 rounds rather than fight.
- `apply()` ends with `observer.takeRecords()` so its own changes don't
  trigger it again.
- Separators are tidied in every managed menu, in the order the menu shows
  them (CSS `order`, for the reorder option): Firefox tidies before this
  runs, in DOM order, and mods that toggle items late (Second Sidebar's
  search item) leave pairs.
- Submenus of managed menus are handled too (`rootMenuOf`).
- The observer gives an item back to whoever toggled its `hidden`; a
  `disabled` change only retidies (for "Hide unavailable options").

## Rearranging: quick actions and "More options"

After hiding, `rearrange()` moves items of a managed menu (the root, not
its submenus): the tab menu's quick actions into `#calmer-tab-actions`, and
items whose keys are in `uc.hidecontext.folded` (a JSON array, like
`uc.hidecontext.items`) into `#calmer-more-options` at the end (inline
`order: 9`, after the reorder option's groups). Each move is recorded with
the item's parent and next sibling and undone in reverse on `popuphidden`,
and the added elements removed, so Firefox, Zen and other mods find the menu
as they built it. Rules:

- Everything the script adds has an id starting with `calmer-`
  (`ownElement`); skip those when recording or keying, and don't manage the
  "More options" popup itself.
- `record()` uses the order saved before rearranging (`layouts`), so
  snapshots and `prev` stay Firefox's, without the script's elements.
- The quick actions' labels are hidden, so they get a shared `<tooltip>`
  that reads the hovered item's label (filled in by Fluent after
  `popupshowing`); only tooltips the script set are removed.
- Shift held while right-clicking shows the whole menu: the window's
  `contextmenu` event says so for menus Zen's own interface opens. The
  page menu is opened from the content process with a synthesized event,
  so Shift can't be seen there; don't claim it is.

## What's recorded

On `popupshown` (plus 250 ms, for Fluent labels) the script saves each
visible item's label, the icon the menu drew (`shownIcon`), its source and
the item before it, and the menu's order (one per kind of target for the
page menu), to `zen-context-menu.json` in the profile. Several windows write
it; `save()` merges what's on disk first. Items unseen for 180 days are
dropped unless hidden.

- Labels pass through `withoutSelection()` first: some quote the selected
  text or a link's text, which must never be written to disk.
- Treat everything recorded as untrusted text: labels come from extensions
  and, through the selection, from pages. The settings page only ever sets
  it with `textContent` (the `h()` helper); keep it that way.

## The settings page

A chrome:// page opened in a tab (system principal). It reads and writes
prefs with `Services` and asks the browser window for `catalog()`. Rows come
from the live menus plus recorded items; labels are `LABELS`, then the
localization id formatted with counts set to one, then the saved label,
then the live one. Icons come from the "Restore icons" rules of
`chrome.css` and the picked icon style's sheet, which the script fetches
from next to itself (keep those rules as `#id { --menu-image: url("…") }`),
then from the recording; snapshots' icons are mapped the same way, so the
page follows the icon style. Outside Zen the page loads `sample.js`
([regenerating it](references/sample-data.md)).

Options with `choices` (the icon style) render as a segmented control with
a few sample icons each; their files must exist in every pack (a test
checks). Each row has a **More** button (shown on hover) that folds it into
"More options"; submenu items can't be folded, hidden ones can't either.
The preview moves folded items into a "More options" entry at the end.

The Backup card exports `makeBackup()` (in `menus.js`): `format`,
`version`, the hidden and folded keys and the `uc.*` style options (the
icon style as its string); the macOS native-menus preference is the
browser's and stays out. A backup without `folded` (made before it
existed) folds nothing. A chrome:// page
can't download with `<a download>`, so export goes through
`nsIFilePicker` and `IOUtils`. An imported file is untrusted:
`parseBackup()` takes only string keys (canonicalized), booleans for
known options and listed values for options with choices, refuses other files and newer versions, and the page asks
before replacing anything. Raise `BACKUP_VERSION` only for a change older
versions would misread, and add a test in `tests/menus.test.mjs`.

The look follows Tab Groups' settings page (oom333/zen-tab-groups): cards,
switches, a sticky preview on the right. Keep new UI in that style and in
both color schemes.

## Adding a menu

Add it to `MENUS` (popup id, name, where to right-click). Give it
`sections` only if its items change a lot with what was right-clicked, like
the page menu; others are listed between their own separators.
`check_selector_targets.mjs` reports a menu id Zen drops.
