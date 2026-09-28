// Opens Zen's context menus through Marionette and reports what they show.
// Used by scripts/check_menus.mjs; the scripts below run in the browser
// window's (chrome) context.

import { setTimeout as sleep } from "node:timers/promises";

/**
 * A test page with every kind of target the page context menu handles.
 * The link has tracking parameters for "Copy Clean Link" to remove.
 */
export const TEST_PAGE = `<!doctype html>
<meta charset="utf-8">
<title>Zen Context Menu test page</title>
<style>body { font: 16px sans-serif; margin: 40px } a, img, input, p { display: block; margin: 20px 0 }</style>
<a id="tracked-link" href="https://example.com/page?utm_source=test&amp;utm_medium=x&amp;id=1">A tracked link</a>
<a id="plain-link" href="https://example.com/plain">A plain link</a>
<img id="image" width="64" height="64" alt="" src="test-image.png">
<input id="input" value="some text">
<p id="paragraph">Selectable paragraph text.</p>
<iframe id="frame" srcdoc="<p id='inside'>Inside a frame</p>"></iframe>
<div id="empty" style="height: 200px"></div>
`;

/** A 1x1 PNG for the test page's image (next to the page, as Firefox treats
 * data: images differently). */
export const TEST_IMAGE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

// Returns the popup's visible entries, top to bottom.
const DESCRIBE = `
function describe(popup) {
  const entries = [];
  for (const el of popup.children) {
    const rect = el.getBoundingClientRect();
    if (el.hidden || getComputedStyle(el).display == "none" || rect.height == 0) {
      continue;
    }
    const icon = el.querySelector(":scope > .menu-icon");
    const iconStyle = icon && getComputedStyle(icon);
    const text = el.querySelector(":scope > .menu-text");
    entries.push({
      id: el.id,
      separator: el.localName == "menuseparator",
      label: el.label || el.getAttribute("label") || text?.value || "",
      disabled: el.hasAttribute("disabled"),
      y: rect.y,
      icon: iconStyle && iconStyle.display != "none" ? iconStyle.content : null,
      textX: text ? Math.round(text.getBoundingClientRect().x) : null,
    });
  }
  return entries.sort((a, b) => a.y - b.y);
}
`;

const OPEN_TAB_MENU = `${DESCRIBE}
const done = arguments[arguments.length - 1];
const popup = document.getElementById("tabContextMenu");
popup.addEventListener("popupshown", async () => {
  await new Promise(r => setTimeout(r, 300));
  done(describe(popup));
}, { once: true });
// A real right-click on a tab does this first.
gBrowser.translateTabContextMenu();
const rect = gBrowser.selectedTab.getBoundingClientRect();
popup.openPopupAtScreen(window.screenX + rect.x + 20, window.screenY + rect.y + 10, true);
`;

const OPEN_MOVE_TAB_SUBMENU = `${DESCRIBE}
const done = arguments[arguments.length - 1];
const menu = document.getElementById("context_moveTabOptions");
if (menu.hidden || getComputedStyle(menu).display == "none") {
  done(null);
} else {
  menu.menupopup.addEventListener("popupshown", async () => {
    await new Promise(r => setTimeout(r, 300));
    done(describe(menu.menupopup));
  }, { once: true });
  menu.openMenu(true);
}
`;

const WAIT_FOR_CONTENT_MENU = `${DESCRIBE}
const done = arguments[arguments.length - 1];
const popup = document.getElementById("contentAreaContextMenu");
const start = Date.now();
(async function poll() {
  if (popup.state == "open") {
    await new Promise(r => setTimeout(r, 300));
    done(describe(popup));
  } else if (Date.now() - start > 10000) {
    done(null);
  } else {
    setTimeout(poll, 50);
  }
})();
`;

const CLOSE_MENUS = `
for (const popup of document.querySelectorAll("menupopup")) {
  if (popup.state == "open" || popup.state == "showing") popup.hidePopup();
}
`;

/**
 * Creates a second space (so Move Tab lists one), opens a few tabs and loads
 * the test page in the selected one.
 *
 * @param {import("./marionette.mjs").Marionette} marionette
 * @param {string} pageUrl
 */
export async function setUpWindow(marionette, pageUrl) {
  const result = await marionette.run(
    `
const [pageUrl, done] = arguments;
const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise(r => setTimeout(r, ms))]);
(async () => {
  await gZenWorkspaces.promiseInitialized;
  if (gZenWorkspaces.getWorkspaces().length < 2) {
    const first = gZenWorkspaces.getWorkspaces()[0];
    await withTimeout(gZenWorkspaces.createAndSaveWorkspace("Second space"), 5000);
    await withTimeout(gZenWorkspaces.changeWorkspace(first), 5000);
  }
  gBrowser.addTrustedTab("about:blank", { inBackground: false });
  gBrowser.addTrustedTab("about:blank", { inBackground: false });
  openTrustedLinkIn(pageUrl, "current");
  const start = Date.now();
  while (Date.now() - start < 15000) {
    const browser = gBrowser.selectedBrowser;
    if (browser.currentURI.spec == pageUrl && !browser.webProgress.isLoadingDocument) {
      await new Promise(r => setTimeout(r, 500));
      done({ spaces: gZenWorkspaces.getWorkspaces().length });
      return;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  done({ error: "the test page didn't load" });
})().catch(e => done({ error: String(e) }));
`,
    [pageUrl],
    { async: true },
  );
  if (result?.error) throw new Error(result.error);
  if (result.spaces < 2) throw new Error("couldn't create a second space");
}

const pageTabs = new WeakSet();

/**
 * Right-clicks an element of the test page, the way a user would.
 *
 * @param {import("./marionette.mjs").Marionette} marionette
 * @param {string} pageUrl
 * @param {string} selector
 * @param {{ selectText?: boolean, frame?: string }} [options] frame: the
 *   iframe (a selector in the page) that selector is in
 */
async function rightClick(
  marionette,
  pageUrl,
  selector,
  { selectText, frame } = {},
) {
  await marionette.send("Marionette:SetContext", { value: "content" });
  try {
    // Find the test page's tab once; Marionette stays on it afterwards.
    if (!pageTabs.has(marionette)) {
      for (const handle of await marionette.send(
        "WebDriver:GetWindowHandles",
      )) {
        await marionette.send("WebDriver:SwitchToWindow", {
          handle,
          focus: true,
        });
        const { value: url } = await marionette.send("WebDriver:GetCurrentURL");
        if (url == pageUrl) {
          pageTabs.add(marionette);
          break;
        }
      }
    }
    await marionette.send("WebDriver:SwitchToParentFrame");
    if (frame) {
      const { value: iframe } = await marionette.send("WebDriver:FindElement", {
        using: "css selector",
        value: frame,
      });
      await marionette.send("WebDriver:SwitchToFrame", { element: iframe });
    }
    await marionette.run(
      `getSelection().removeAllRanges();
       document.activeElement?.blur?.();
       if (arguments[1]) {
         const range = document.createRange();
         range.selectNodeContents(document.querySelector(arguments[0]));
         getSelection().addRange(range);
       }`,
      [selector, !!selectText],
    );
    const { value: element } = await marionette.send("WebDriver:FindElement", {
      using: "css selector",
      value: selector,
    });
    await marionette.send("WebDriver:PerformActions", {
      actions: [
        {
          type: "pointer",
          id: "mouse",
          parameters: { pointerType: "mouse" },
          actions: [
            { type: "pointerMove", origin: element, x: 0, y: 0 },
            { type: "pointerDown", button: 2 },
            { type: "pointerUp", button: 2 },
          ],
        },
      ],
    });
    await marionette.send("WebDriver:ReleaseActions");
    if (frame) await marionette.send("WebDriver:SwitchToParentFrame");
  } finally {
    await marionette.send("Marionette:SetContext", { value: "chrome" });
  }
}

/**
 * @param {import("./marionette.mjs").Marionette} marionette
 * @param {string} pageUrl
 * @param {string} selector
 * @param {{ selectText?: boolean, frame?: string }} [options]
 */
async function contentMenu(marionette, pageUrl, selector, options) {
  await rightClick(marionette, pageUrl, selector, options);
  const entries = await marionette.run(WAIT_FOR_CONTENT_MENU, [], {
    async: true,
  });
  await marionette.run(CLOSE_MENUS);
  await sleep(100);
  if (!entries) throw new Error(`no context menu opened on ${selector}`);
  return entries;
}

/**
 * @param {import("./marionette.mjs").Marionette} marionette
 * @param {string} [setup] script to run first
 * @param {string} [cleanup] script to run afterwards
 */
async function tabMenu(marionette, setup, cleanup) {
  if (setup) await marionette.run(setup);
  try {
    return await marionette.run(OPEN_TAB_MENU, [], { async: true });
  } finally {
    await marionette.run(CLOSE_MENUS);
    if (cleanup) await marionette.run(cleanup);
    await sleep(100);
  }
}

/**
 * Each scenario opens one menu and returns its visible entries, or null when
 * the menu can't be reached (a submenu whose item is hidden).
 *
 * @type {Object<string, (marionette: import("./marionette.mjs").Marionette, pageUrl: string) => Promise<Array<object>>>}
 */
export const SCENARIOS = {
  "tab menu": (m) => tabMenu(m),
  "tab menu, pinned tab": (m) =>
    tabMenu(
      m,
      "gBrowser.pinTab(gBrowser.selectedTab);",
      "gBrowser.unpinTab(gBrowser.selectedTab);",
    ),
  "tab menu, two tabs selected": (m) =>
    tabMenu(
      m,
      `const other = gBrowser.visibleTabs.find(
         tab => tab != gBrowser.selectedTab && !tab.pinned && !tab.hasAttribute("zen-empty-tab"));
       gBrowser.addToMultiSelectedTabs(other);
       if (gBrowser.selectedTabs.length != 2) throw new Error("couldn't select two tabs");`,
      "gBrowser.clearMultiSelectedTabs();",
    ),
  "Move Tab submenu": async (m) => {
    try {
      await m.run(OPEN_TAB_MENU, [], { async: true });
      return await m.run(OPEN_MOVE_TAB_SUBMENU, [], { async: true });
    } finally {
      await m.run(CLOSE_MENUS);
      await sleep(100);
    }
  },
  "link with tracking parameters": (m, url) =>
    contentMenu(m, url, "#tracked-link"),
  "plain link": (m, url) => contentMenu(m, url, "#plain-link"),
  image: (m, url) => contentMenu(m, url, "#image"),
  "text field": (m, url) => contentMenu(m, url, "#input"),
  "selected text": (m, url) =>
    contentMenu(m, url, "#paragraph", { selectText: true }),
  page: (m, url) => contentMenu(m, url, "#empty"),
  frame: (m, url) => contentMenu(m, url, "#inside", { frame: "#frame" }),
};
