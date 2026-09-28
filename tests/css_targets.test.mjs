import assert from "node:assert/strict";
import test from "node:test";

import {
  extractChromeUrls,
  extractDefinedClasses,
  extractDefinedIds,
  extractJarUrls,
  extractOptionBlocks,
  extractPrefs,
  extractSelectorTargets,
  findMissingTargets,
  lintSeparators,
} from "../scripts/css_targets.mjs";
import { pickLatestRelease } from "../scripts/zen_release.mjs";

const CSS = `
/* #commented-out .not-a-class -moz-pref("uc.commented") */
@media -moz-pref("uc.hidecontext.example") {
  #tabContextMenu > :is(#context_one, .some-class):not([hidden]) {
    display: none !important;
  }
  menuitem[id="placesContext_open:newtab"],
  :is(#context_toggleMuteTab)[data-l10n-id*="unmute.tab"] {
    --menu-image: url("chrome://browser/skin/zen-icons/pin.svg");
    background: -moz-element(#zen-browser-background) center / cover;
  }
  .textbox-contextmenu menuitem:is([cmd="cmd_copy"]) {
    --menu-image: url(chrome://global/skin/icons/edit.svg);
    opacity: 0.5;
  }
}
`;

test("extractPrefs finds -moz-pref() queries outside comments", () => {
  assert.deepEqual([...extractPrefs(CSS)], ["uc.hidecontext.example"]);
});

test("extractChromeUrls finds quoted and unquoted chrome:// urls", () => {
  assert.deepEqual([...extractChromeUrls(CSS)].sort(), [
    "chrome://browser/skin/zen-icons/pin.svg",
    "chrome://global/skin/icons/edit.svg",
  ]);
});

test("extractSelectorTargets reads ids and classes from selectors only", () => {
  const { ids, classes } = extractSelectorTargets(CSS);
  assert.deepEqual([...ids].sort(), [
    "context_one",
    "context_toggleMuteTab",
    "placesContext_open:newtab",
    "tabContextMenu",
    "zen-browser-background",
  ]);
  // Not "hidecontext", "5", "unmute" or anything from urls and comments.
  assert.deepEqual([...classes].sort(), ["some-class", "textbox-contextmenu"]);
});

test("extractDefinedIds covers markup and the ways scripts set ids", () => {
  const ids = extractDefinedIds(`
    <menuitem id="context_markup" data-l10n-id="x"/>
    item.setAttribute("id", "context_setattr");
    item.id = "context_property";
    const def = { id: "context_object" };
    <menuitem id="context_\${dynamic}"/>
  `);
  assert.deepEqual([...ids].sort(), [
    "context_markup",
    "context_object",
    "context_property",
    "context_setattr",
  ]);
});

test("extractDefinedClasses covers markup, className and classList", () => {
  const classes = extractDefinedClasses(`
    <menupopup class="textbox-contextmenu other"/>
    el.className = "share-tab-url-item";
    el.classList.add("added-one", "added-two");
    el.setAttribute("class", "set-by-attribute");
  `);
  assert.deepEqual([...classes].sort(), [
    "added-one",
    "added-two",
    "other",
    "set-by-attribute",
    "share-tab-url-item",
    "textbox-contextmenu",
  ]);
});

test("extractJarUrls maps packaged skin files to chrome:// urls", () => {
  const urls = extractJarUrls(`
#ifdef XP_WIN
*  skin/classic/browser/zen-icons/pin.svg      (../shared/zen-icons/nucleo/pin.svg)
#endif
  skin/classic/global/icons/edit.svg (../../shared/icons/edit.svg)
+  skin/classic/browser/zen-added.svg (../shared/zen-added.svg)
  content/global/not-a-skin.js (not-a-skin.js)
`);
  assert.deepEqual([...urls].sort(), [
    "chrome://browser/skin/zen-added.svg",
    "chrome://browser/skin/zen-icons/pin.svg",
    "chrome://global/skin/icons/edit.svg",
  ]);
});

test("findMissingTargets reports what the sources no longer define", () => {
  const defined = {
    ids: new Set([
      "tabContextMenu",
      "context_one",
      "placesContext_open:newtab",
      "zen-browser-background",
      "PersonalToolbar",
    ]),
    classes: new Set(["textbox-contextmenu"]),
    urls: new Set(["chrome://global/skin/icons/edit.svg"]),
  };
  const css = `${CSS} #toggle_PersonalToolbar, #toggle_toolbar-menubar { order: 1 !important; }`;
  assert.deepEqual(findMissingTargets(css, defined), [
    "#context_toggleMuteTab is not defined anymore",
    // Built at runtime from the toolbar's id, which is gone here.
    "#toggle_toolbar-menubar is not defined anymore",
    ".some-class is not used anymore",
    "chrome://browser/skin/zen-icons/pin.svg is not packaged anymore",
  ]);
});

test("extractOptionBlocks splits chrome.css by option", () => {
  const blocks = extractOptionBlocks(`
/* @media -moz-pref("uc.commented") { #nope {} } */
@media -moz-pref("uc.hidecontext.one") {
  #context_one { display: none !important; }
  @media -moz-pref("uc.hidecontext.two") and -moz-pref("uc.other") {
    #context_nested { display: none !important; }
  }
}
@media -moz-pref("uc.hidecontext.two") {
  #context_two { display: none !important; }
}
`);
  assert.deepEqual(
    [...blocks.keys()],
    ["uc.hidecontext.one", "uc.hidecontext.two"],
  );
  assert.deepEqual(
    [...extractSelectorTargets(blocks.get("uc.hidecontext.one")).ids],
    ["context_one", "context_nested"],
  );
  assert.deepEqual(
    [...extractSelectorTargets(blocks.get("uc.hidecontext.two")).ids],
    ["context_two"],
  );
});

test("lintSeparators flags separators at the edges and next to each other", () => {
  const sep = (id) => ({ separator: true, id });
  const item = (id) => ({ id });
  assert.deepEqual(lintSeparators([item("a"), sep("s1"), item("b")]), []);
  assert.deepEqual(lintSeparators([]), []);
  assert.deepEqual(
    lintSeparators([
      sep("top"),
      item("a"),
      sep(),
      sep("s2"),
      item("b"),
      sep("end"),
    ]),
    [
      "#top is at the top",
      "#end is at the bottom",
      "a separator and #s2 are next to each other",
    ],
  );
});

test("pickLatestRelease sorts Zen's version tags numerically", () => {
  assert.equal(
    pickLatestRelease([
      "1.9b",
      "1.22b",
      "twilight-1",
      "1.22.3b",
      "1.22.10b",
      "1.3",
    ]),
    "1.22.10b",
  );
  assert.equal(pickLatestRelease(["twilight"]), undefined);
});
