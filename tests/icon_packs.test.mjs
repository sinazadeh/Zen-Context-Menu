import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import {
  buildPackCss,
  iconRules,
  ICON_PACK_PREF,
} from "../scripts/build_icon_packs.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const css = await read("chrome.css");
const packs = JSON.parse(await read("context-menu/icons/packs.json"));
const preferences = JSON.parse(await read("preferences.json"));
const Z = vm.runInNewContext(
  `${await read("context-menu/menus.js")}; ZenContextMenuShared`,
  {},
);
const rules = iconRules(css);

test("the icon styles' style sheets are up to date", async () => {
  for (const [id, pack] of Object.entries(packs)) {
    assert.equal(
      await read(`context-menu/icons/${id}.css`),
      buildPackCss(css, id, pack),
      `context-menu/icons/${id}.css is out of date: run node scripts/build_icon_packs.mjs`,
    );
  }
});

test("the icon styles are the same everywhere", () => {
  // menus.js (the script and the settings page), preferences.json (Sine's
  // options box) and packs.json; Zen's is chrome.css's own.
  // (Array.from: menus.js runs in its own realm.)
  const listed = Array.from(Z.ICON_PACKS, ({ id }) => id);
  assert.equal(listed[0], "zen");
  assert.deepEqual(listed.slice(1), Object.keys(packs));
  assert.equal(Z.PREF_ICON_PACK, ICON_PACK_PREF);
  const pref = preferences.find((p) => p.property === ICON_PACK_PREF);
  assert.deepEqual(
    pref.options.map(({ value }) => value),
    listed,
  );
  assert.equal(pref.defaultValue, "zen");
});

test("packs.json maps chrome.css's icons and items", () => {
  const urls = new Set(rules.map(({ url }) => url));
  const selectors = new Set(rules.flatMap((rule) => rule.selectors));
  for (const [id, pack] of Object.entries(packs)) {
    for (const url of Object.keys(pack.icons)) {
      assert.ok(urls.has(url), `${id}: chrome.css doesn't use ${url}`);
    }
    for (const selector of Object.keys(pack.items)) {
      assert.ok(selectors.has(selector), `${id}: no icon rule for ${selector}`);
    }
  }
});

test("every icon a pack uses is in its folder, and every file is used", async () => {
  for (const [id, pack] of Object.entries(packs)) {
    const used = new Set([
      ...Object.values(pack.icons),
      ...Object.values(pack.items),
    ]);
    const files = new Set(
      (
        await readdir(new URL(`../context-menu/icons/${id}/`, import.meta.url))
      ).filter((name) => name.endsWith(".svg")),
    );
    for (const name of used) {
      assert.match(name, /^[\w-]+\.svg$/, `${id}: ${name}`);
      assert.ok(files.has(name), `${id}/${name} is missing`);
    }
    for (const name of files) {
      assert.ok(used.has(name), `${id}/${name} isn't used`);
    }
  }
});

test("pack icons take the menu's text color", async () => {
  // Drawn with context-fill, like Zen's, so they follow the theme instead
  // of being black.
  for (const id of Object.keys(packs)) {
    const dir = new URL(`../context-menu/icons/${id}/`, import.meta.url);
    for (const name of await readdir(dir)) {
      if (name.endsWith(".svg")) {
        const svg = await readFile(new URL(name, dir), "utf8");
        assert.match(svg, /context-fill/, `${id}/${name}`);
        assert.doesNotMatch(svg, /<script|href="(?!#)/i, `${id}/${name}`);
      }
    }
  }
});

test("a pack's style sheet lists every item, so it always wins", () => {
  for (const [id, pack] of Object.entries(packs)) {
    const sheet = buildPackCss(css, id, pack);
    for (const selector of rules.flatMap((rule) => rule.selectors)) {
      assert.ok(sheet.includes(`    ${selector}`), `${id}: ${selector}`);
    }
  }
});

test("an item with its own icon in a pack isn't mirrored", () => {
  const redo = rules.find((rule) => rule.selectors.includes("#context-redo"));
  assert.ok(redo.flipped, "chrome.css mirrors Undo's icon for Redo");
  const sheet = buildPackCss(css, "x", {
    name: "X",
    icons: { [redo.url]: "undo.svg" },
    items: { "#context-redo": "redo.svg" },
  });
  assert.match(
    sheet,
    /#context-redo[^{]*\{\s*--menu-image: url\("x\/redo\.svg"\);\s*> \.menu-icon \{\s*transform: none;/,
  );
});

test("the settings page's sample icons are in every icon style", () => {
  for (const [id, pack] of Object.entries(packs)) {
    for (const name of ["edit-copy", "reload", "pin", "share"]) {
      assert.ok(
        Object.values(pack.icons).includes(`${name}.svg`),
        `${id}/${name}.svg`,
      );
      assert.ok(
        rules.some(
          ({ url }) => url === `chrome://browser/skin/zen-icons/${name}.svg`,
        ),
        `zen-icons/${name}.svg`,
      );
    }
  }
});
