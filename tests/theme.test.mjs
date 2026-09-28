import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");
const theme = JSON.parse(await read("theme.json"));

test("theme.json has the fields Sine uses", () => {
  for (const field of ["id", "name", "description", "homepage", "author"]) {
    assert.equal(typeof theme[field], "string", field);
    assert.ok(theme[field].length > 0, field);
  }
  assert.match(theme.homepage, /^https:\/\/github\.com\//);
  // Sine offers an update when updatedAt is newer than the installed copy's.
  assert.match(theme.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!Number.isNaN(Date.parse(theme.updatedAt)));
  // Not the theme store's UUID: a store copy and this fork must not collide.
  assert.notEqual(theme.id, "81fcd6b3-f014-4796-988f-6c3cb3874db8");
});

test("theme.json points at files that exist", async () => {
  for (const field of ["style", "preferences", "readme"]) {
    await access(new URL(theme[field], ROOT));
  }
});

test("the version matches the changelog and chrome.css", async () => {
  const changelog = await read("CHANGELOG.md");
  const [, latest, date] = changelog.match(/^## \[(\d[^\]]*)\] - (\S+)/m);
  assert.equal(theme.version, latest, "latest CHANGELOG.md release");
  assert.equal(theme.updatedAt, date, "date of the latest release");
  const css = await read("chrome.css");
  assert.match(
    css.split("\n")[0],
    new RegExp(
      `^/\\* Zen Context Menu v${theme.version.replaceAll(".", "\\.")}\\b`,
    ),
  );
});

test("there is only one mod in the repository", async () => {
  // Sine treats a repository with several theme.json files as a collection of
  // mods, and finds chrome.css and preferences.json by name.
  const found = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if ([".git", "node_modules", ".cache"].includes(entry.name)) continue;
      const url = new URL(
        `${entry.name}${entry.isDirectory() ? "/" : ""}`,
        dir,
      );
      if (entry.isDirectory()) await walk(url);
      else if (
        /^(theme\.json|(user)?chrome\.css|preferences\.json)$/i.test(entry.name)
      ) {
        found.push(url.href.slice(ROOT.href.length));
      }
    }
  };
  await walk(ROOT);
  assert.deepEqual(found.sort(), [
    "chrome.css",
    "preferences.json",
    "theme.json",
  ]);
});
