import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// context-menu/menus.js is a plain script shared by the browser window and
// the settings page; run it the way they do.
const Z = vm.runInNewContext(
  `${await read("context-menu/menus.js")}\nZenContextMenuShared;`,
  {},
);
const preferences = JSON.parse(await read("preferences.json"));
const css = await read("chrome.css");
// Arrays from another context don't deepEqual this one's.
const plain = (value) => JSON.parse(JSON.stringify(value));

test("itemKey prefers ids, then localization ids, commands and labels", () => {
  const key = (info) => Z.itemKey({ tag: "menuitem", ...info }, "menu");
  assert.equal(
    key({ id: "context_pinTab", label: "Pin Tab" }),
    "#context_pinTab",
  );
  assert.equal(
    key({ l10n: "zen-panel-ui-workspaces-create", command: "cmd_x" }),
    "menu|l10n:zen-panel-ui-workspaces-create",
  );
  assert.equal(
    key({ command: "cmd_zenNewEmptySplit" }),
    "menu|cmd:cmd_zenNewEmptySplit",
  );
  assert.equal(key({ label: "Something" }), "menu|label:Something");
  assert.equal(key({}), null);
});

test("itemKey keeps extensions' items apart from their session ids", () => {
  const key = (info) =>
    Z.itemKey({ tag: "menuitem", extension: true, ...info }, "menu");
  // Named by the extension: stable.
  assert.equal(
    key({ id: "_d634138d-c276-4fc8-924b-40a0ea21d284_-menuitem-_fill" }),
    "#_d634138d-c276-4fc8-924b-40a0ea21d284_-menuitem-_fill",
  );
  // Numbered by Firefox, differently every session.
  assert.equal(
    key({ id: "read-later_example_com-menuitem-12", label: "Open list" }),
    "ext:read-later_example_com|Open list",
  );
  assert.equal(
    key({
      tag: "menu",
      id: "read-later_example_com-menuitem-3",
      extType: "top-level-menu",
      label: "Read Later",
    }),
    "ext:read-later_example_com",
  );
  assert.equal(key({ id: "read-later_example_com-menuitem-4" }), null);
});

test("widgetId matches Firefox's ids for extensions", () => {
  assert.equal(Z.widgetId("read-later@example.com"), "read-later_example_com");
  assert.equal(
    Z.widgetId("{D634138D-c276-4fc8-924b-40a0ea21d284}"),
    "_d634138d-c276-4fc8-924b-40a0ea21d284_",
  );
});

test("extensionOf finds the extension of an item key", () => {
  assert.equal(
    Z.extensionOf("ext:read-later_example_com|Open list"),
    "read-later_example_com",
  );
  assert.equal(
    Z.extensionOf("#_d634138d-c276-4fc8-924b-40a0ea21d284_-menuitem-_fill"),
    "_d634138d-c276-4fc8-924b-40a0ea21d284_",
  );
  assert.equal(Z.extensionOf("#context_pinTab"), null);
});

test("sourceOf recognizes Zen's and mods' items", () => {
  assert.equal(Z.sourceOf({ id: "context_zen-add-essential" }), "Zen");
  assert.equal(Z.sourceOf({ l10n: "zen-panel-ui-folder-create" }), "Zen");
  assert.equal(Z.sourceOf({ command: "cmd_zenNewEmptySplit" }), "Zen");
  assert.equal(
    Z.sourceOf({ id: "context_opentabaswebpanel" }),
    "Second Sidebar",
  );
  assert.equal(Z.sourceOf({ id: "context_zsg-settings" }), "Tab Groups");
  assert.equal(Z.sourceOf({ id: "context_pinTab" }), null);
});

test("aliases point at items that aren't aliases themselves", () => {
  for (const [alias, target] of Object.entries(Z.ALIASES)) {
    assert.notEqual(alias, target);
    assert.ok(!(target in Z.ALIASES), `${alias} -> ${target} is a chain`);
    assert.equal(Z.canonicalKey(alias), target);
  }
  assert.equal(Z.canonicalKey("#context_closeTab"), "#context_closeTab");
});

test("separatorsToHide leaves no separator at an edge or next to another", () => {
  const item = (visible = true) => ({ separator: false, visible });
  const sep = (visible = true) => ({ separator: true, visible });
  const hide = (entries) =>
    [...Z.separatorsToHide(entries)].sort((a, b) => a - b);
  assert.deepEqual(hide([item(), sep(), item()]), []);
  assert.deepEqual(hide([sep(), item(), sep()]), [0, 2]);
  // Everything between two separators hidden.
  assert.deepEqual(hide([item(), sep(), item(false), sep(), item()]), [3]);
  // Already hidden separators are left alone.
  assert.deepEqual(hide([item(), sep(false), sep(), item()]), []);
  assert.deepEqual(hide([item(false), sep(), item(false)]), [1]);
  assert.deepEqual(hide([]), []);
});

test("groupRows splits menus without sections at their separators", () => {
  const rows = [
    { separator: true },
    { key: "#a" },
    { separator: true },
    { separator: true },
    { key: "#b" },
    { key: "#c" },
    { separator: true },
  ];
  assert.deepEqual(
    plain(Z.groupRows({}, rows)).map((group) =>
      group.rows.map((row) => row.key),
    ),
    [["#a"], ["#b", "#c"]],
  );
});

test("groupRows puts unnamed items with their neighbors", () => {
  const menu = {
    sections: [
      { title: "Links", ids: ["link1", "link2"] },
      { title: "Search", ids: ["search"] },
    ],
  };
  const groups = plain(
    Z.groupRows(menu, [
      { key: "#zen-before" },
      { key: "#link1" },
      { key: "#mod-link" },
      { separator: true },
      { key: "#link2" },
      { key: "#search" },
      { key: "#mod-search" },
      { key: "#ext", extension: true },
      { key: "#mod-end" },
    ]),
  );
  assert.deepEqual(
    groups.map((group) => [group.title, group.rows.map((row) => row.key)]),
    [
      ["Links", ["#zen-before", "#link1", "#mod-link", "#link2"]],
      ["Search", ["#search"]],
      ["More", ["#mod-search", "#mod-end"]],
      ["Extensions", ["#ext"]],
    ],
  );
});

test("parseHidden ignores anything that isn't an item key", () => {
  assert.deepEqual(
    [
      ...Z.parseHidden(
        '["#context_unpinTab", 3, "", null, "#context_closeTab"]',
      ),
    ],
    ["#context_pinTab", "#context_closeTab"],
  );
  assert.deepEqual([...Z.parseHidden("not json")], []);
  assert.deepEqual([...Z.parseHidden('{"a": 1}')], []);
  assert.equal(Z.serializeHidden(new Set(["#b", "#a"])), '["#a","#b"]');
});

test("the old Hide options are turned into hidden items", () => {
  const on = new Set(["uc.hidecontext.reloadtab", "uc.hidecontext.pin"]);
  assert.deepEqual(plain(Z.legacyHiddenKeys((pref) => on.has(pref))), [
    "#context_reloadTab",
    "#toolbar-context-reloadSelectedTab",
    "#context_pinTab",
    "#context_zen-add-essential",
  ]);
});

test("the old Hide options are gone from preferences.json and chrome.css", () => {
  // Otherwise they'd be migrated away while still shown as options.
  const options = new Set(preferences.map(({ property }) => property));
  for (const pref of Object.keys(Z.LEGACY_PREFS)) {
    assert.ok(!options.has(pref), `${pref} is still an option`);
    assert.ok(!css.includes(`"${pref}"`), `${pref} is still in chrome.css`);
  }
});

test("DEFAULT_ON lists the options that are on by default", () => {
  const defaults = preferences
    .filter(
      (pref) => pref.property.startsWith("uc.") && pref.defaultValue === true,
    )
    .map((pref) => pref.property)
    .sort();
  assert.deepEqual(plain(Z.DEFAULT_ON).sort(), defaults);
});

test("the settings page shows every option of preferences.json", async () => {
  const settings = await read("context-menu/settings.js");
  const shown = [...settings.matchAll(/pref: "([^"]+)"/g)]
    .map((m) => m[1])
    .sort();
  assert.deepEqual(shown, preferences.map(({ property }) => property).sort());
});

test("menus and sections are listed once", () => {
  const menus = Z.MENUS.map((menu) => menu.id);
  assert.equal(new Set(menus).size, menus.length);
  const ids = Z.MENUS.flatMap((menu) =>
    (menu.sections ?? []).flatMap((section) => section.ids),
  );
  assert.equal(new Set(ids).size, ids.length, "an id is in two sections");
  for (const key of [...Z.SUGGESTED, ...Object.values(Z.LEGACY_PREFS).flat()]) {
    assert.match(key, /^#[\w:-]+$/);
  }
});

test("withoutSelection keeps the selected text out of saved labels", () => {
  const selection = "  Selectable paragraph text. ";
  assert.equal(
    Z.withoutSelection("Search Google for “Selectable par…”", selection),
    "Search Google for “…”",
  );
  assert.equal(
    Z.withoutSelection(
      "Search “Selectable paragraph…” in Second Sidebar",
      selection,
    ),
    "Search “…” in Second Sidebar",
  );
  assert.equal(
    Z.withoutSelection('Look up "hunter2pass" now', "hunter2pass"),
    'Look up "…" now',
  );
  assert.equal(Z.withoutSelection("Copy", selection), "Copy");
  // Too short to tell apart from ordinary words.
  assert.equal(Z.withoutSelection("Ship it", "hi"), "Ship it");
});
