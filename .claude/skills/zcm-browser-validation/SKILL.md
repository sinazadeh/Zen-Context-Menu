---
name: zcm-browser-validation
description: Validating Zen Context Menu Enhanced in a real Zen - the headless Marionette harness the menu check uses, loading the script like Sine does, screenshots of the settings page, and the manual scenarios to record in a pull request. Use when a change touches menus, the script or the settings page, before claiming it works, or when writing a pull request's manual-validation notes.
---

# Validating in Zen

Node tests cover `menus.js` and the files' consistency; nothing else runs
without a browser.

## Headless, with the menu check

`MOZ_HEADLESS=1 node scripts/check_menus.mjs` downloads Zen for Linux into
`.cache/`, starts it with Marionette, and opens real menus (see
`zcm-zen-updates` for what it checks). For anything it doesn't cover, drive
Zen the same way: [headless Zen](references/headless-zen.md) explains
loading the script like Sine, installing a test extension, other mods, and
screenshotting the settings page.

## By hand

Use a test profile with Sine (add the repository as
`<owner>/<repo>/tree/<branch>` to test a branch) and JS from unofficial
sources allowed, or fx-autoconfig. Then, as the change needs:

- **Settings page**: open it from the sidebar's context menu and from the
  gear in Sine; hide and show items, check the preview and the menus follow
  (in a second window too); search; light and dark themes.
- **Extensions and mods**: an extension with menu items (1Password, say)
  shows up after opening a menu that has them, tagged with its name;
  Second Sidebar's and Tab Groups' items are tagged.
- **Tab menu**: regular tab, pinned tab, Essential, several selected tabs,
  a tab in a split view; Move Tab still lists other spaces.
- **Page menu**: a link with `?utm_source=` and one without, an image, a
  video, selected text, a text field, an empty area.
- **Toolbar, bookmark, space and folder menus** when changing those.
- No two separators next to each other, none at the top or bottom; with
  restored icons, labels line up.
- **Sine**: switch the mod off (everything shows again, no restart) and back
  on; update from the previous version (old "Hide ..." options migrate).

Check the Browser Console for `[Zen Context Menu Enhanced]` errors. Record the Zen
version (`about:support`), OS, loader and what you checked; say what you
couldn't (macOS native menus, Windows).
