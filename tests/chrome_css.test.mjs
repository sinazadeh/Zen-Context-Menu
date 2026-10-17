import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { extractChromeUrls, stripComments } from "../scripts/css_targets.mjs";

const css = await readFile(new URL("../chrome.css", import.meta.url), "utf8");
const code = stripComments(css);

/** @returns {Array<{ property: string, value: string, line: number }>} */
function declarations() {
  const result = [];
  // Good enough for this file: declarations end with ";" and never contain
  // braces; nested rules and at-rules end with "{" or "}".
  const re = /([\w-]+)\s*:\s*([^;{}]+);/g;
  for (const match of code.matchAll(re)) {
    const line = code.slice(0, match.index).split("\n").length;
    result.push({ property: match[1], value: match[2].trim(), line });
  }
  return result;
}

test("braces are balanced", () => {
  let depth = 0;
  for (const char of code.replace(/"[^"]*"|'[^']*'/g, "")) {
    if (char === "{") depth++;
    if (char === "}") depth--;
    assert.ok(depth >= 0, "unexpected }");
  }
  assert.equal(depth, 0);
});

test("no position-based selectors", () => {
  // Zen and Firefox add and move menu entries between releases, so
  // :nth-child() and friends end up matching the wrong items.
  assert.doesNotMatch(code, /:nth-(last-)?(child|of-type)\(/);
});

test("display and order declarations are !important", () => {
  // Zen loads mods as a user style sheet, which loses to the browser's own
  // (author) styles without !important.
  for (const { property, value, line } of declarations()) {
    if (property === "display" || property === "order") {
      assert.match(value, /!important$/, `line ${line}: ${property}: ${value}`);
    }
  }
});

test("everything is gated behind an option", () => {
  // The mod shouldn't change anything the user didn't turn on.
  const stack = [];
  for (const [token, before] of code.matchAll(/([^{}]*)\{|\}/g)) {
    if (token === "}") {
      stack.pop();
      continue;
    }
    // Skip declarations that come before a nested rule.
    const prelude = before.split(";").at(-1).trim();
    const isOption = /^@media\b.*-moz-pref\(/s.test(prelude);
    assert.ok(
      isOption || stack.includes(true),
      `"${prelude}" is not inside a -moz-pref() block`,
    );
    stack.push(isOption);
  }
  assert.equal(stack.length, 0);
});

test("urls point at browser resources or inline data", () => {
  for (const [, url] of code.matchAll(/url\(\s*["']?([^"')]+)/g)) {
    assert.match(url, /^(chrome:\/\/(browser|global)\/skin\/|data:)/, url);
  }
  assert.ok(extractChromeUrls(css).size > 0);
});

test("hiding unavailable options covers the menus the settings page lists", async () => {
  const { readFile: read } = await import("node:fs/promises");
  const vm = await import("node:vm");
  const Z = vm.runInNewContext(
    `${await read(new URL("../context-menu/menus.js", import.meta.url), "utf8")}; ZenContextMenuShared`,
    {},
  );
  const start = code.indexOf('@media -moz-pref("uc.hidecontext.disabled")');
  assert.ok(start >= 0);
  const block = code.slice(start, code.indexOf("[disabled]", start));
  const menus = [...block.matchAll(/#([\w-]+)/g)].map((m) => m[1]);
  assert.deepEqual(menus.sort(), Array.from(Z.MENUS, (menu) => menu.id).sort());
});

test("an alternative option only applies while the one it gives way to is off", async () => {
  // EXCLUSIVE_OPTIONS in menus.js: when two are on anyway (chrome.css on its
  // own, without the script), the first of the group wins.
  const { readFile: read } = await import("node:fs/promises");
  const vm = await import("node:vm");
  const Z = vm.runInNewContext(
    `${await read(new URL("../context-menu/menus.js", import.meta.url), "utf8")}; ZenContextMenuShared`,
    {},
  );
  for (const [first, ...others] of Z.EXCLUSIVE_OPTIONS) {
    for (const pref of others) {
      const media = code.match(
        new RegExp(
          `@media -moz-pref\\("${pref.replaceAll(".", "\\.")}"\\)[^{]*\\{`,
        ),
      );
      assert.ok(media, `no block for ${pref}`);
      assert.ok(
        media[0].includes(`and (not -moz-pref("${first}"))`),
        `${pref} doesn't give way to ${first}`,
      );
    }
  }
});
