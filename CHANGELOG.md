# Changelog

Notable changes to this fork of KiKaraage's Zen Context Menu. Versions match
`version` in `theme.json`; bump `updatedAt` along with it, as that date is
what tells Sine an update is available.

## [Unreleased]

## [4.0.0] - 2026-09-28

First release of the fork, based on Zen Context Menu v3.1 from the Zen theme
store and checked against Zen 1.22.3b (Firefox 156).

### Fixed

- The tab menu reorder (on by default) no longer hides **Duplicate Tab** and
  **Move Tab**. Zen now lists your other spaces under Move Tab, so there was
  no way left to move a tab to another space
  ([KiKaraage/ZenMods#55](https://github.com/KiKaraage/ZenMods/issues/55)).
- The reorder no longer stacks up to four separators on top of each other or
  puts **Close Tab** below **Add Route for Domain**. It used item positions,
  which Zen and Firefox have changed since; every item is now matched by its
  id ([KiKaraage/ZenMods#54](https://github.com/KiKaraage/ZenMods/issues/54)).
  Hiding **Duplicate Tab** had the same problem.
- **Hide 'Select All Tabs'** works on its own instead of following the
  reorder option
  ([KiKaraage/ZenMods#63](https://github.com/KiKaraage/ZenMods/issues/63)).
- **Hide 'Unload Tabs'** and **Hide 'Ask AI chatbot'** do something: the
  first had no style behind it, and the second looked at a differently named
  preference. Hiding the chatbot now covers the tab menu too.
- **Apply Zen workspace gradient** shows your space's gradient again
  ([KiKaraage/ZenMods#64](https://github.com/KiKaraage/ZenMods/issues/64)).
  Zen now paints the gradient on the browser background instead of the whole
  window, and Firefox renamed the menu background variable; both color options
  now set the new one. Text uses the color Zen picks for contrast with the
  gradient.
- **Prioritize 'Copy Clean Link'** shows only "Copy Clean Link" when it
  would remove tracking parameters and only "Copy Link" otherwise; before, both
  were always shown. The same now applies to "Copy (Clean) Link to Highlight".
- **Restore icons** draws icons in each item's own icon slot instead of behind
  the label, so they no longer overlap labels like "Copy"
  ([KiKaraage/ZenMods#56](https://github.com/KiKaraage/ZenMods/issues/56)) and
  line up on every platform. 24 icons that Zen has since removed are replaced
  with current Zen or Firefox icons, and a submenu's icon no longer shows on
  every item inside it.
- **Hide 'Translate Selection'**, **Hide 'Take Screenshot'** and **Hide
  'This Frame'** no longer remove the separator above the Inspect items, and
  hiding "This Frame" no longer leaves two separators next to each other
  inside frames.
- `preferences.json` uses real booleans for default values, which the Zen
  theme store's checks require (Sine would also read the text `"false"` as
  on).

### Changed

- The reorder option only reorders (and hides options that are disabled
  anyway). **Bookmark Tab** is hidden by **Hide 'Bookmark Link'** again, and
  **Close Multiple Tabs** has its own option; both stay hidden by default, as
  before. **Move Tab** has its own option and is shown by default.
- **Hide all icons** covers the tab, page, toolbar, bookmark, space and text
  field context menus and their submenus, as the option describes; before, it
  only reached some text field and checkbox menus.

### Added

- Options to hide **New Tab Below**, **Move Tab**, **Move to Folder**,
  **Close Multiple Tabs**, **Change Label/Change Icon**, **Add Route for
  Domain**, **Open Link in Glance/Split Link to New Tab**, **Copy Link to
  Highlight** and **Search Image with Google Lens**.
- Icons for Zen's newer menu items (Move to Folder, Change Label/Icon, Glance,
  space routing, Edit Pinned URL...).

### Removed

- Selectors for items Zen or Firefox removed: web panels, Pocket, the old
  "Change Tab to Workspace" menu and old workspace items.
- A rule that appended "Plus" to `.wordmark` elements, which had nothing to do
  with context menus.
