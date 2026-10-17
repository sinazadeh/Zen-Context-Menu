# Driving a headless Zen

`scripts/check_menus.mjs` is the reference: it builds a profile (`user.js`
with `marionette.port`, `ui.popup.disable_autohide`, and `chrome.css` as
`chrome/userChrome.css` with
`toolkit.legacyUserProfileCustomizations.stylesheets`), starts Zen with
`--marionette -remote-allow-system-access`, and talks to it with
`scripts/marionette.mjs` in the chrome context.

## Loading the script like Sine

```js
const startup = Cc["@mozilla.org/addons/addon-manager-startup;1"].getService(
  Ci.amIAddonManagerStartup,
);
// Keep the handle: the package is unregistered once it's garbage collected,
// and pages then fail with "File not found" a few seconds later.
window.keepChrome = startup.registerChrome(
  Services.io.newURI("file:///path/to/repo/theme.json"),
  [["content", "zcmtest", "./"]],
);
Services.scriptloader.loadSubScriptWithOptions(
  "chrome://zcmtest/content/context-menu.uc.js",
  { target: window, ignoreCache: true },
);
```

The manifest URI must be a file in the folder, not the folder itself. Other
mods load the same way: Tab Groups is a `.uc.js`; Second Sidebar is a
module, so compile a one-line loader (`import("chrome://…/second_sidebar.uc.mjs")`)
with `ChromeUtils.compileScript(url)` and `executeInGlobal(window)`.

## A test extension

`AddonManager.installTemporaryAddon(nsIFile)` on a folder with a
`manifest.json` (`"permissions": ["menus"]`, a gecko id) and a background
script calling `browser.menus.create(...)`; give some items ids and leave
one without, to cover both kinds of keys.

## Pages and screenshots

Menus that depend on a site need HTTP: serve a page from Node and set
`network.dns.localDomains` to `example.com` so it isn't `localhost`. Open
the settings page with `gBrowser.addTrustedTab(ZenContextMenu.settingsURL)`
and take `WebDriver:TakeScreenshot` in the chrome context after
`window.resizeTo(...)`; set `layout.css.prefers-color-scheme.content-override`
(0 dark, 1 light) for each theme. Popups don't appear in headless
screenshots; describe them from the DOM instead (`menu_scenarios.mjs`):
positions from `getBoundingClientRect()` relative to the popup (icon and
label columns, the quick actions' row), computed `content`, `display`,
`order` and `--menu-image`.

A menu's items have no computed style until it has opened once (its shadow
DOM, and so its slot, is built on the first `popupshowing`), so a closed
menu reads as empty. To check an icon style, open a `menupopup` of your own
with `menuitem`s carrying the ids to test. To check an icon is tinted, draw
its URL in an `<img>` with `-moz-context-properties: fill; fill: red` on the
window and count red pixels in `drawSnapshot()`: a `file://` icon, or one
without `context-fill`, comes out black or not at all.
