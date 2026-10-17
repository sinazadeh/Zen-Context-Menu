# Changelog

Notable changes to this fork of KiKaraage's Zen Context Menu. Versions match
`version` in `theme.json`; bump `updatedAt` along with it, as that time is
what tells Sine an update is available. Once a version reaches `main`, it's
published as a GitHub release with its notes below (see
`.github/workflows/release.yml`).

## [Unreleased]

### Added

- **Icon style**: Zen's icons, **Fluent** or **ZenUI** for "Icons for every
  option" and the quick actions, picked on the settings page (with a few
  icons of each) or in Sine's options. Fluent and ZenUI are from
  [Context Menu Icons](https://github.com/Starry-AXQG/Context-Menu-Icons) by
  Starry-AXQG (MIT License), and take the menu's text color like Zen's.
- **Quick actions in the tab menu**: Reload, Pin, Add to Essentials and
  Bookmark as a row of buttons at the top, with their names as tooltips.
- **More options**: point at an item on the settings page and click
  **More** to move it into a "More options" submenu at the end of its menu,
  instead of hiding it. The preview shows it there, backups include it, and
  holding Shift while right-clicking a tab, the sidebar or a toolbar shows the
  whole menu.
- **Hide unavailable options**: hides the options Zen shows greyed out, like
  Paste with nothing copied.
- **Gray extension icons** and **Faint separators**.
- Icons for more items with "Icons for every option": split view (Add Split
  View, Separate, Reverse), tab notes, Close Tabs Above/Below and Close
  Other Tabs, Move to Start/End, Zen's folder and space menus (rename, change
  icon, unload, new subfolder, unpack, convert to space, share, manage
  spaces), frames, PDF editing, Copy Email/Phone, Copy Text From Image,
  saved passwords, dictionaries, playback speed, Link Preview and more.

### Fixed

- "Icons for every option" lines icons and labels up in one column whatever
  padding Zen, the platform or a theme gives menu items (some themes left
  room for a missing icon, which pushed the icons inward), and draws icons
  in the color of the menu's labels at full strength, so they no longer
  come out black or faint on themes that only color the labels.
- The PDF viewer's **Copy** had the Copy Link icon.

## [5.1.1] - 2026-10-17

### Changed

- Every version from 4.0.0 on has a GitHub release with its notes and a zip
  of `context-menu.uc.js`, `context-menu/` and `chrome.css` for
  fx-autoconfig, and new versions are released automatically once the
  version bump reaches `main`.
- `updatedAt` in `theme.json` is a full timestamp, so Sine notices two
  releases made on the same day. 5.1.0 kept 5.0.0's date, so copies of
  5.0.0 weren't offered it; they're offered this version.

## [5.1.0] - 2026-10-17

### Added

- A **Backup** card on the settings page: **Export settings…** saves the
  hidden items and the **Appearance** options to a JSON file, and **Import
  settings…** restores them from one, after asking, for instance in another
  profile. Files that aren't a backup, or come from a newer version of the
  mod, are refused with a message saying why.

### Changed

- Renamed to **Zen Calmer Context Menu** (Calmer Context Menu for short),
  and the repository to
  [sinazadeh/zen-calmer-context-menu](https://github.com/sinazadeh/zen-calmer-context-menu).
  Links to the old names (`zen-context-menu`, `zen-context-menu-enhanced`)
  still lead there, and Sine keeps updating copies installed from them; to
  install it again, add `sinazadeh/zen-calmer-context-menu`. Saved settings
  carry over: preference names and the mod's id are unchanged.

## [5.0.0] - 2026-10-17

Checked against Zen 1.23.3b (Firefox 158).

### Added

- A settings page that lists every item of Zen's context menus (tabs, pages,
  sidebar and toolbars, bookmarks, spaces, folders and the + button), with a
  switch to hide each one. It includes the items Zen, other mods (such as
  Second Sidebar and Tab Groups) and extensions add, tagged with where they
  come from, and the items inside submenus. Open it from the sidebar's
  context menu (**Customize Context Menus…**) or the mod's gear button in
  Sine.
- A preview of each menu as it looked the last time it was opened, without
  the hidden items; the page menu keeps one for each kind of thing you
  right-clicked (page, link, image, video, selected text, text field).
- `context-menu.uc.js`, which hides the chosen items when a menu opens, also
  in menus Zen or extensions fill in later, and hides separators left at the
  top or bottom of a menu or next to each other (also when another mod leaves
  them there). Items are shown again when
  the menu closes, so whatever Zen does with them next is unaffected. Sine can
  switch the mod off or update it without a restart.
- A suggestion on the settings page to hide what version 4 hid by default.
- The **Appearance** options on the settings page, including the macOS menu
  switch on macOS.

### Changed

- The "Hide ..." options are replaced by the item list. Options you had on
  become hidden items the first time the script runs (and are then cleared
  from `about:config`).
- Options that are on by default (reorder the tab menu, one Copy Link option)
  now apply as soon as the mod runs, without opening its options in Sine first.
- The mod now needs JavaScript (Sine with JS from unofficial sources allowed,
  or fx-autoconfig) to hide items. `chrome.css` alone still provides the style
  options.

### Removed

- The 33 "Hide ..." options from `preferences.json` and `chrome.css`.

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
