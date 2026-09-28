// Opens Zen's context menus with chrome.css loaded and checks what they show,
// for every option. Run by .github/workflows/menus.yml; locally (Linux, with
// an X server or under xvfb-run):
//
//   xvfb-run -a node scripts/check_menus.mjs [--zen=<zen binary>] [--version=<release>] [--port=<n>] [--only=<option,...>]
//
// Without --zen it downloads the latest Zen release (or --version) for Linux
// into .cache/. Checks:
//   - No menu has a separator at its top or bottom, or two next to each other,
//     with no option on, with the defaults, and with each option on (alone and
//     on top of the defaults).
//   - Each "hide" option hides something, and only items its own block of
//     chrome.css points at. An option that hides nothing while its items are
//     showing has stopped working.
//   - With the defaults, the tab menu keeps Duplicate Tab and Move Tab (which
//     lists the other spaces), and a link shows either "Copy Link" or
//     "Copy Clean Link", depending on whether there's anything to clean.
//   - With restored icons, labels line up and the items the option gives an
//     icon show it.

import { spawn } from "node:child_process";
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  extractOptionBlocks,
  extractSelectorTargets,
  lintSeparators,
} from "./css_targets.mjs";
import { Marionette } from "./marionette.mjs";
import {
  SCENARIOS,
  setUpWindow,
  TEST_IMAGE,
  TEST_PAGE,
} from "./menu_scenarios.mjs";
import { downloadZen, latestZenRelease } from "./zen_release.mjs";

const ROOT = new URL("..", import.meta.url);
const EMPTY_ICON = "data:image/svg+xml";

const BROWSER_PREFS = {
  "toolkit.legacyUserProfileCustomizations.stylesheets": true,
  "browser.shell.checkDefaultBrowser": false,
  "browser.startup.homepage_override.mstone": "ignore",
  "browser.startup.page": 0,
  "browser.tabs.warnOnClose": false,
  "datareporting.policy.dataSubmissionEnabled": false,
  "app.update.disabledForTesting": true,
  "zen.welcome-screen.seen": true,
  "ui.popup.disable_autohide": true,
};

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    args[key] = value ?? true;
  }
  return args;
}

/**
 * @param {Array<{ separator: boolean, id: string, label: string }>} entries
 * @returns {Set<string>} the items (not separators) a menu shows
 */
const itemsOf = (entries) =>
  new Set(
    (entries ?? []).filter((e) => !e.separator).map((e) => e.id || e.label),
  );

/**
 * @param {Marionette} marionette
 * @param {Array<string>} options every option's preference
 * @param {Object<string, boolean>} values the ones to turn on
 */
async function setOptions(marionette, options, values) {
  await marionette.run(
    `const [options, values] = arguments;
     for (const pref of options) Services.prefs.setBoolPref(pref, !!values[pref]);`,
    [options, values],
  );
}

/**
 * @param {Marionette} marionette
 * @param {string} pageUrl
 * @returns {Promise<Map<string, Array<object>>>} entries of every scenario
 */
async function openMenus(marionette, pageUrl) {
  const menus = new Map();
  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    menus.set(name, await scenario(marionette, pageUrl));
  }
  return menus;
}

async function main() {
  const args = parseArgs();
  const css = await readFile(new URL("chrome.css", ROOT), "utf8");
  const preferences = JSON.parse(
    await readFile(new URL("preferences.json", ROOT), "utf8"),
  );
  const options = preferences
    .map(({ property }) => property)
    .filter((property) => property.startsWith("uc."));
  const defaults = Object.fromEntries(
    preferences
      .filter(({ defaultValue }) => defaultValue === true)
      .map(({ property }) => [property, true]),
  );
  const blocks = extractOptionBlocks(css);
  const only = args.only ? new Set(args.only.split(",")) : null;
  // Options that change how menus look rather than hiding items.
  const appearanceOptions = new Set([
    "uc.hidecontext.icons",
    "uc.hidecontext.separators",
  ]);
  const hideOptions = options.filter(
    (option) =>
      option.startsWith("uc.hidecontext.") && (!only || only.has(option)),
  );

  let binary = args.zen;
  if (!binary) {
    const version = args.version ?? latestZenRelease();
    console.log(`Downloading Zen ${version}...`);
    binary = await downloadZen(version, new URL(".cache", ROOT).pathname);
  }

  const profile = await mkdtemp(join(tmpdir(), "zen-context-menu-"));
  const port = Number(args.port ?? 2828);
  await mkdir(join(profile, "chrome"));
  // Loaded as a user style sheet, like Zen and Sine load mods.
  await writeFile(join(profile, "chrome", "userChrome.css"), css);
  const prefs = { ...BROWSER_PREFS, "marionette.port": port };
  await writeFile(
    join(profile, "user.js"),
    Object.entries(prefs)
      .map(
        ([key, value]) =>
          `user_pref(${JSON.stringify(key)}, ${JSON.stringify(value)});`,
      )
      .join("\n"),
  );
  const pagePath = join(profile, "test-page.html");
  await writeFile(pagePath, TEST_PAGE);
  await writeFile(join(profile, "test-image.png"), TEST_IMAGE);
  const pageUrl = pathToFileURL(pagePath).href;

  const browser = spawn(
    binary,
    [
      "--marionette",
      "-remote-allow-system-access",
      "--no-remote",
      "--profile",
      profile,
      "about:blank",
    ],
    {
      env: { ...process.env, MOZ_CRASHREPORTER_DISABLE: "1" },
      stdio: "ignore",
    },
  );
  const failures = [];
  const notes = [];
  const fail = (run, menu, problem) =>
    failures.push(`[${run}] ${menu}: ${problem}`);
  let marionette;
  try {
    marionette = await Marionette.connect(port);
    await marionette.start();
    const version = await marionette.run("return Services.appinfo.version;");
    console.log(`Checking menus in Zen ${version}`);
    await setUpWindow(marionette, pageUrl);

    const results = new Map();
    const check = async (run, values) => {
      await setOptions(marionette, options, values);
      const menus = await openMenus(marionette, pageUrl);
      for (const [menu, entries] of menus) {
        for (const problem of lintSeparators(entries ?? [])) {
          fail(run, menu, problem);
        }
      }
      results.set(run, menus);
      process.stdout.write(".");
      return menus;
    };

    const none = await check("no options", {});
    const withDefaults = await check("defaults", defaults);

    // Defaults: nothing a user needs is gone.
    const tab = itemsOf(withDefaults.get("tab menu"));
    for (const id of ["context_duplicateTab", "context_moveTabOptions"]) {
      if (!tab.has(id)) fail("defaults", "tab menu", `#${id} is hidden`);
    }
    if (!itemsOf(withDefaults.get("Move Tab submenu")).has("Second space")) {
      fail("defaults", "Move Tab submenu", "doesn't list the other space");
    }
    const tracked = itemsOf(withDefaults.get("link with tracking parameters"));
    if (
      !tracked.has("context-stripOnShareLink") ||
      tracked.has("context-copylink")
    ) {
      fail(
        "defaults",
        "link with tracking parameters",
        "should only show Copy Clean Link",
      );
    }
    const plain = itemsOf(withDefaults.get("plain link"));
    if (
      !plain.has("context-copylink") ||
      plain.has("context-stripOnShareLink")
    ) {
      fail("defaults", "plain link", "should only show Copy Link");
    }

    // Each option, alone and with the defaults.
    for (const option of hideOptions) {
      const targets = extractSelectorTargets(blocks.get(option) ?? "").ids;
      const alone = await check(option, { [option]: true });
      // Appearance options (icons, separators) don't hide items.
      if (!appearanceOptions.has(option)) {
        let hidSomething = false;
        let hasTargets = false;
        for (const [menu, entries] of alone) {
          // A submenu the option made unreachable (Move Tab) is covered by its
          // parent menu.
          if (!entries) continue;
          const before = itemsOf(none.get(menu));
          const after = itemsOf(entries);
          for (const item of before) {
            if (targets.has(item)) hasTargets = true;
            if (after.has(item)) continue;
            hidSomething = true;
            if (!targets.has(item)) fail(option, menu, `also hides ${item}`);
          }
          for (const item of after) {
            if (!before.has(item)) fail(option, menu, `makes ${item} appear`);
          }
        }
        if (!hidSomething && hasTargets) {
          fail(
            option,
            "all menus",
            "hides nothing, though its items are showing",
          );
        } else if (!hidSomething) {
          notes.push(
            `${option}: none of its items show up in the tested menus`,
          );
        }
      }
      if (!defaults[option]) {
        await check(`${option} + defaults`, { ...defaults, [option]: true });
      }
    }

    // Restored icons.
    if (!only) {
      const iconTargets = extractSelectorTargets(
        blocks.get("uc.fixcontext.restoreicons") ?? "",
      ).ids;
      const run = "restore icons";
      for (const [menu, entries] of await check(run, {
        ...defaults,
        "uc.fixcontext.restoreicons": true,
      })) {
        const items = (entries ?? []).filter(
          (e) => !e.separator && e.textX !== null,
        );
        const columns = new Set(items.map((e) => e.textX));
        if (columns.size > 1) {
          fail(
            run,
            menu,
            `labels don't line up (x = ${[...columns].join(", ")})`,
          );
        }
        for (const entry of items) {
          if (
            iconTargets.has(entry.id) &&
            (!entry.icon || entry.icon.includes(EMPTY_ICON))
          ) {
            fail(run, menu, `#${entry.id} shows no icon`);
          }
        }
      }
    }
    console.log();
  } finally {
    await marionette?.quit();
    browser.kill();
    await rm(profile, { recursive: true, force: true });
  }

  const summary = [
    `### Zen menus: ${failures.length === 0 ? "all checks passed" : `${failures.length} problem(s)`}`,
    ...failures.map((failure) => `- ${failure}`),
    ...(notes.length
      ? ["", "Not exercised by the test page:", ...notes.map((n) => `- ${n}`)]
      : []),
  ];
  console.log(summary.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      summary.join("\n") + "\n",
    );
  }
  process.exitCode = failures.length === 0 ? 0 : 1;
}

await main();
