import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { extractPrefs } from "../scripts/css_targets.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const preferences = JSON.parse(await read("preferences.json"));
const css = await read("chrome.css");

// Firefox's own preferences the mod exposes; everything else is the mod's.
const BROWSER_PREFS = new Set(["widget.macos.native-context-menus"]);

// The Zen theme store's schema (scripts/submit_theme.py in
// zen-browser/theme-store), which Zen's and Sine's mod managers also rely on.
const FIELDS = new Set([
  "property",
  "label",
  "type",
  "options",
  "defaultValue",
  "disabledOn",
  "placeholder",
]);
const VALUE_TYPES = {
  checkbox: ["boolean"],
  dropdown: ["string", "number"],
  string: ["string"],
};
const OSES = new Set(["linux", "macos", "windows"]);

test("preferences.json matches the Zen theme store schema", () => {
  assert.ok(Array.isArray(preferences));
  for (const pref of preferences) {
    const name = pref.property;
    for (const field of Object.keys(pref)) {
      assert.ok(FIELDS.has(field), `${name}: unknown field ${field}`);
    }
    assert.match(name, /^[A-Za-z0-9\-_.]+$/, `${name}: invalid property`);
    assert.equal(typeof pref.label, "string", `${name}: label`);
    assert.ok(pref.label.length > 0, `${name}: empty label`);
    assert.ok(pref.type in VALUE_TYPES, `${name}: unknown type ${pref.type}`);
    if ("defaultValue" in pref) {
      // A string "false" would turn the option on: Sine only checks
      // truthiness, and Zen passes it to setBoolPref.
      assert.ok(
        VALUE_TYPES[pref.type].includes(typeof pref.defaultValue),
        `${name}: defaultValue must be a ${VALUE_TYPES[pref.type].join("/")}`,
      );
    }
    if ("disabledOn" in pref) {
      assert.ok(Array.isArray(pref.disabledOn), `${name}: disabledOn`);
      for (const os of pref.disabledOn) {
        assert.ok(OSES.has(os), `${name}: unknown OS ${os}`);
      }
    }
  }
});

test("preference properties are unique", () => {
  const seen = new Set();
  for (const { property } of preferences) {
    assert.ok(!seen.has(property), `duplicate preference ${property}`);
    seen.add(property);
  }
});

test("every option in preferences.json is used by chrome.css", () => {
  // An option that isn't used shows a checkbox that does nothing.
  const used = extractPrefs(css);
  for (const { property } of preferences) {
    if (!BROWSER_PREFS.has(property)) {
      assert.ok(used.has(property), `${property} is not used by chrome.css`);
    }
  }
});

test("every -moz-pref() in chrome.css has an option in preferences.json", () => {
  const declared = new Set(preferences.map(({ property }) => property));
  for (const pref of extractPrefs(css)) {
    assert.ok(declared.has(pref), `${pref} has no option in preferences.json`);
  }
});

test("labels mention which options are enabled by default", () => {
  for (const { property, label, defaultValue } of preferences) {
    if (BROWSER_PREFS.has(property)) continue;
    assert.equal(
      label.includes("(enabled by default)"),
      defaultValue === true,
      `${property}: label and defaultValue disagree`,
    );
  }
});
