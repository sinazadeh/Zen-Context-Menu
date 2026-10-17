# Regenerating sample.js

`context-menu/sample.js` is what `ZenContextMenu.catalog()` returned in a
real Zen, saved as `var ZenContextMenuSample = {...}` with a `hidden` list
added. The settings page loads it only when it can't reach the script
(opened as a file, or before a restart).

To make a new one:

1. Start Zen with Marionette as in
   [browser validation](../../zcm-browser-validation/references/headless-zen.md),
   load the script, and load the mods you want to show (Tab Groups, Second
   Sidebar) and a temporary test extension with menu items.
2. Serve a test page over HTTP under a real-looking host (set
   `network.dns.localDomains` to `example.com`), and open each menu once:
   `SCENARIOS` in `scripts/menu_scenarios.mjs` does this.
3. `await window.ZenContextMenu.catalog()`, set every snapshot's `at` to a
   fixed date, add a `hidden` array, and write the file.

Don't include anything from a personal profile: real tab titles, sites or
extension names.
