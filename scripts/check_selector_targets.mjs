// Checks that every menu id, class and icon chrome.css points at still exists
// in Zen and in the Firefox release it's built on. Run weekly by
// .github/workflows/selector-targets.yml, so a Zen or Firefox change that
// breaks an option shows up before (or right after) users get it. Locally:
//
//   node scripts/check_selector_targets.mjs [--css=<file>] [zen-ref...]
//
// (defaults: the repository's chrome.css, and "release").
//
// A zen-ref is "release" (the latest Zen release tag), "dev" (Zen's
// development branch), or any branch or tag of
// https://github.com/zen-browser/desktop. Firefox sources come from
// https://github.com/mozilla-firefox/firefox at the FIREFOX_<version>_RELEASE
// tag of the version in Zen's surfer.json. Needs git and network access.
//
// A missing id means an option silently stopped doing anything; see AGENTS.md
// ("Keeping up with Zen") for how to find where an item went.

import { execFileSync } from "node:child_process";
import { appendFile, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  extractDefinedClasses,
  extractDefinedIds,
  extractJarUrls,
  findMissingTargets,
} from "./css_targets.mjs";
import { latestZenRelease, ZEN_REPO } from "./zen_release.mjs";
const FIREFOX_RAW = "https://raw.githubusercontent.com/mozilla-firefox/firefox";

// Firefox files defining the menus and icons chrome.css uses. Zen's own
// sources are scanned whole (see ZEN_PATHS), as its files move around more.
const FIREFOX_SOURCES = [
  "browser/base/content/browser-context.inc.xhtml",
  "browser/base/content/main-popupset.inc.xhtml",
  "browser/base/content/navigator-toolbox.inc.xhtml",
  "browser/components/places/content/placesContextMenu.inc.xhtml",
  "browser/components/urlbar/content/SmartbarInput.mjs",
  "browser/components/urlbar/content/UrlbarInputBase.mjs",
  "browser/components/sharing/SharingUtils.sys.mjs",
  "toolkit/actors/SelectParent.sys.mjs",
  "toolkit/content/editMenuOverlay.js",
  "toolkit/content/widgets/menu.js",
  "toolkit/content/widgets/moz-input-box.js",
];
const FIREFOX_JARS = [
  "browser/themes/shared/jar.inc.mn",
  "toolkit/themes/shared/desktop-jar.inc.mn",
  "toolkit/themes/shared/minimal-toolkit.jar.inc.mn",
];
const ZEN_PATHS = ["src/zen", "src/browser"];
const SOURCE_EXTENSIONS = /\.(xhtml|inc|js|mjs|patch|html|mn)$/;

/**
 * @param {string} dir
 * @returns {AsyncGenerator<string>} paths of source files under dir
 */
async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "tests" && entry.name !== "test") yield* walk(path);
    } else if (SOURCE_EXTENSIONS.test(entry.name)) {
      yield path;
    }
  }
}

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`could not fetch ${url} (HTTP ${response.status})`);
  }
  return response.text();
}

/**
 * @param {string} ref
 * @param {string} css
 * @returns {Promise<{ heading: string, problems: Array<string> }>}
 */
async function checkRef(ref, css) {
  const zenRef = ref === "release" ? latestZenRelease() : ref;
  const dir = await mkdtemp(join(tmpdir(), "zen-src-"));
  try {
    const git = (...args) =>
      execFileSync("git", ["-C", dir, ...args], { stdio: "pipe" });
    execFileSync("git", [
      "-c",
      "advice.detachedHead=false",
      "clone",
      "--quiet",
      "--depth=1",
      "--filter=blob:none",
      "--sparse",
      `--branch=${zenRef}`,
      ZEN_REPO,
      dir,
    ]);
    git("sparse-checkout", "set", ...ZEN_PATHS);

    const surfer = JSON.parse(await readFile(join(dir, "surfer.json"), "utf8"));
    const zenVersion =
      surfer.brands?.release?.release?.displayVersion ?? zenRef;
    const firefoxVersion = surfer.version.version;
    const firefoxTag = `FIREFOX_${firefoxVersion.replaceAll(".", "_")}_RELEASE`;

    const defined = { ids: new Set(), classes: new Set(), urls: new Set() };
    const addSource = (source) => {
      for (const id of extractDefinedIds(source)) defined.ids.add(id);
      for (const cls of extractDefinedClasses(source)) defined.classes.add(cls);
    };
    for (const path of ZEN_PATHS) {
      for await (const file of walk(join(dir, path))) {
        const source = await readFile(file, "utf8");
        // Jar manifests (and Zen's patches to Firefox's) list the icons.
        if (/jar[.-]/.test(file)) {
          for (const url of extractJarUrls(source)) defined.urls.add(url);
        } else {
          addSource(source);
        }
      }
    }

    const [sources, jars] = await Promise.all([
      Promise.all(
        FIREFOX_SOURCES.map((p) =>
          fetchText(`${FIREFOX_RAW}/${firefoxTag}/${p}`),
        ),
      ),
      Promise.all(
        FIREFOX_JARS.map((p) => fetchText(`${FIREFOX_RAW}/${firefoxTag}/${p}`)),
      ),
    ]);
    sources.forEach(addSource);
    for (const jar of jars) {
      for (const url of extractJarUrls(jar)) defined.urls.add(url);
    }

    return {
      heading: `Zen ${zenVersion} (${zenRef}) on Firefox ${firefoxVersion}`,
      problems: findMissingTargets(css, defined),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
const cssArg = args.find((arg) => arg.startsWith("--css="));
const css = await readFile(
  cssArg
    ? cssArg.slice("--css=".length)
    : new URL("../chrome.css", import.meta.url),
  "utf8",
);
const refs = args.filter((arg) => !arg.startsWith("--"));
const summary = [];
let failed = false;
for (const ref of refs.length > 0 ? refs : ["release"]) {
  let heading, problems;
  try {
    ({ heading, problems } = await checkRef(ref, css));
  } catch (error) {
    heading = `Zen ${ref}`;
    problems = [
      `check failed: ${error instanceof Error ? error.message : error}`,
    ];
  }
  failed ||= problems.length > 0;
  const title = `${heading}: ${problems.length === 0 ? "all selector targets OK" : `${problems.length} problem(s)`}`;
  console.log(title);
  for (const problem of problems) console.log(`  - ${problem}`);
  summary.push(`### ${title}`, ...problems.map((problem) => `- ${problem}`));
}

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary.join("\n") + "\n");
}
process.exitCode = failed ? 1 : 0;
