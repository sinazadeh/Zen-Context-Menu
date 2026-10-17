# Repository guidance

## Project and runtime

Zen Calmer Context Menu is a mod for [Zen Browser](https://zen-browser.app) that
hides context menu items, reorders the tab context menu, restores menu icons
and can tint menus with the current space's colors. It's a fork of
KiKaraage's mod from the Zen theme store
([source](https://github.com/zen-browser/theme-store/tree/main/themes/81fcd6b3-f014-4796-988f-6c3cb3874db8),
[author's repository](https://github.com/KiKaraage/ZenMods)); keep the credit
in `README.md`, `LICENSE` and the `chrome.css` header, and the credit to
[oom333/zen-tab-groups](https://github.com/oom333/zen-tab-groups) for the
settings page's format in `README.md`, and to
[Context Menu Icons](https://github.com/Starry-AXQG/Context-Menu-Icons) by
Starry-AXQG for the Fluent and ZenUI icons (`context-menu/icons/LICENSE`)
and the features taken from it, in `README.md` and the `chrome.css` header.

It has two parts, with no build step:

- **The item list**: `context-menu.uc.js` runs in every browser window and
  hides the items chosen on the settings page (`context-menu/`), saved in
  the string preference `uc.hidecontext.items`, moves the ones in
  `uc.hidecontext.folded` into "More options", and builds the tab menu's
  quick actions.
- **The style options**: `chrome.css`, preferences read with
  `@media -moz-pref("...")` and listed in `preferences.json`; the icon
  styles' style sheets in `context-menu/icons/`, which the script loads.

Users install it with [Sine](https://github.com/CosmoCreeper/Sine) (which
reads `theme.json`) or fx-autoconfig; `chrome.css` also works on its own.
Read `README.md` before changing behavior.

**Read this file as a map.** It holds only what applies to every change;
each area's rules and their reasons live in a skill under `.claude/skills/`
(Claude Code loads them by description, other agents open the linked file).
Read the matching skill before changing code there, and put new detail in
it, not here: `scripts/lint_agent_config.mjs` (run by `node --test`) keeps
this file within 150 lines and checks that it links every skill, agent and
command.

## Code map

| Location                             | Responsibility                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `context-menu.uc.js`                 | Hides items as menus open, records what they show, serves the settings page.       |
| `context-menu/menus.js`              | Shared by script, page and tests: menus, sections, aliases, keys, separator logic. |
| `context-menu/settings.*`            | The settings page (chrome privileges, opened in a tab).                            |
| `context-menu/sample.js`             | Sample data the settings page shows outside Zen.                                   |
| `context-menu/icons/`                | Fluent and ZenUI icons, `packs.json` and the style sheets generated from them.     |
| `chrome.css`, `preferences.json`     | The style options.                                                                 |
| `theme.json`                         | Sine manifest: style, preferences, readme and the script.                          |
| `image.png`, `previews/`             | Preview images (`image.png` is KiKaraage's).                                       |
| `scripts/check_selector_targets.mjs` | Checks `chrome.css`'s ids, classes and icons, and `menus.js`'s menus, against Zen. |
| `scripts/check_menus.mjs`            | Opens real menus in a downloaded Zen with each option on and items hidden.         |
| `scripts/menu_scenarios.mjs`         | The menus `check_menus.mjs` opens, and how.                                        |
| `scripts/css_targets.mjs`            | Pure helpers for the checks; separator lint.                                       |
| `scripts/marionette.mjs`             | Minimal Marionette client for Zen.                                                 |
| `scripts/zen_release.mjs`            | Finds and downloads Zen releases.                                                  |
| `scripts/lint_agent_config.mjs`      | Lints this map and `.claude/`.                                                     |
| `scripts/build_icon_packs.mjs`       | Writes the icon styles' style sheets from `chrome.css` and `packs.json`.           |
| `tests/`                             | Node unit tests: `menus.js`, file consistency, CSS conventions, agent config.      |

## Skills: where the detail lives

| Before you…                                                                     | Read                                                                     |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| change the script, the settings page, item keys, aliases, sections or recording | [zcm-item-list](.claude/skills/zcm-item-list/SKILL.md)                   |
| change `chrome.css`, `preferences.json`, the icon styles or add a style option  | [zcm-style-options](.claude/skills/zcm-style-options/SKILL.md)           |
| touch `theme.json`, the script's start or unload, or debug "nothing happens"    | [zcm-loader](.claude/skills/zcm-loader/SKILL.md)                         |
| fix a weekly check, or an item or option Zen broke                              | [zcm-zen-updates](.claude/skills/zcm-zen-updates/SKILL.md)               |
| validate in Zen, or write a pull request's manual-validation notes              | [zcm-browser-validation](.claude/skills/zcm-browser-validation/SKILL.md) |
| prepare a release, or change the Release workflow or the changelog's structure  | [zcm-release](.claude/skills/zcm-release/SKILL.md)                       |
| edit `.github/workflows/`, lint or format config, or `scripts/`                 | [zcm-ci-workflows](.claude/skills/zcm-ci-workflows/SKILL.md)             |

## Conventions for every change

- **Never rename a preference or change how an item's key is made.** Users'
  choices are saved under them, and the names are shared with the theme
  store version.
- Match items by id, in CSS and in `menus.js`; never by position. Zen and
  Firefox move items between releases.
- The mod must not change what the user didn't ask for: CSS only inside its
  option's `-moz-pref()` block, items hidden only when the user hid them
  (tidying separators is the one exception).
- Hide items with the `hidden` attribute and give them back when the menu
  closes; undo everything on unload (Sine switches the mod off live).
- Text from menus (labels, extension names) is untrusted: on the settings
  page it's set with `textContent` only, and selected text never reaches
  disk.
- Keep `menus.js` free of browser APIs: the Node tests load it.
- Classic scripts in `context-menu.uc.js` and `context-menu/`, ES modules in
  `scripts/` and `tests/`. Two spaces, double quotes, Prettier.
- Update the README for user-visible changes and add them to
  `[Unreleased]` in `CHANGELOG.md`. Keep edits focused.

## Agents and commands

Each subagent in `.claude/agents/` does one job on a model matched to it:
`opus` where a wrong call is costly, `sonnet` for checklists, tests and
docs, `haiku` for running checks. Implementation stays in the main session.
Commands in `.claude/commands/` chain the agents into workflows.

| Agent                                                          | Model  | Job                                                        |
| -------------------------------------------------------------- | ------ | ---------------------------------------------------------- |
| [zcm-code-reviewer](.claude/agents/zcm-code-reviewer.md)       | opus   | Correctness and invariant review of a diff                 |
| [zcm-security-auditor](.claude/agents/zcm-security-auditor.md) | opus   | Privilege, injection and privacy review                    |
| [zcm-css-reviewer](.claude/agents/zcm-css-reviewer.md)         | sonnet | Style-option rules for `chrome.css` and `preferences.json` |
| [zcm-test-writer](.claude/agents/zcm-test-writer.md)           | sonnet | Node unit tests for pure logic                             |
| [zcm-docs-updater](.claude/agents/zcm-docs-updater.md)         | sonnet | README, changelog and skill updates                        |
| [zcm-checks-runner](.claude/agents/zcm-checks-runner.md)       | haiku  | Run the checks and report                                  |

| Command                                                         | Workflow                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| [/zcm-check](.claude/commands/zcm-check.md)                     | Checks (add `--menus` for the run in Zen)                       |
| [/zcm-review](.claude/commands/zcm-review.md)                   | Parallel specialist review, verified and merged into one report |
| [/zcm-add-option](.claude/commands/zcm-add-option.md)           | Plan, implement, test, document and review a style option       |
| [/zcm-prepare-release](.claude/commands/zcm-prepare-release.md) | Version bump, changelog section, checks and release dry run     |

## Static checks

Install the tools ad hoc (the repository has no `package.json` on purpose):

```sh
npm install --no-save --package-lock=false eslint@9.7.0 @eslint/js@9.7.0 globals@15 prettier@3.9.9
```

Then run:

```sh
node --test "tests/*.test.mjs"
npx prettier --check "**/*.{css,js,mjs,html,md,json,yml}"
npx eslint .
git diff --check
```

and, when `chrome.css`, the script or `menus.js` changed (both need git and
network access; the second downloads Zen for Linux into `.cache/` and runs
it headless):

```sh
node scripts/check_selector_targets.mjs release dev
MOZ_HEADLESS=1 node scripts/check_menus.mjs
```

Record the Zen version, OS and what you checked by hand in the pull request
([zcm-browser-validation](.claude/skills/zcm-browser-validation/SKILL.md)).
