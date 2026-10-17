---
name: zcm-ci-workflows
description: How CI and the development tools are set up - no package.json, the pinned ESLint and Prettier versions, the eslint.config.mjs sections, and the Tests, Prettier, ESLint, Selector targets, Menus and Release workflows. Use when editing .github/workflows/, eslint.config.mjs, .prettierrc or scripts/, or when CI fails where local checks passed.
---

# CI and tooling

The repository has no `package.json` on purpose. Tools are installed ad hoc,
at the same versions CI uses:

```sh
npm install --no-save --package-lock=false eslint@9.7.0 @eslint/js@9.7.0 globals@15 prettier@3.9.9
```

## Workflows

| Workflow               | When                                                          | Runs                                                    |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| `tests.yml`            | push and pull requests to `main`                              | `node --test "tests/*.test.mjs"`                        |
| `prettier.yml`         | push and pull requests to `main`                              | `prettier --check "**/*.{css,js,mjs,html,md,json,yml}"` |
| `eslint.yml`           | push and pull requests to `main`                              | `eslint .`                                              |
| `selector-targets.yml` | weekly, and pull requests touching `chrome.css` or `scripts/` | `check_selector_targets.mjs` for release and dev        |
| `menus.yml`            | weekly, and pull requests touching the mod or `scripts/`      | `check_menus.mjs` in the latest Zen, headless           |
| `release.yml`          | `theme.json` changes on `main`; a dry run on pull requests    | `publish_releases.mjs` (see `zcm-release`)              |

`tests/` includes `agent_config.test.mjs`, which runs
`scripts/lint_agent_config.mjs` on `AGENTS.md` and `.claude/`.

## ESLint

`eslint.config.mjs` has two sections: Node for `scripts/`, `tests/` and root
`.mjs` files, and browser plus Gecko globals (`Services`, `Cc`, `Ci`,
`IOUtils`, `gBrowser`...) for `context-menu.uc.js` and `context-menu/*.js`,
which are classic scripts. `.cache/` (the downloaded Zen) is ignored. Add a
global there only when the code really reads it.

## Prettier

Everything is formatted, Markdown and `.claude/` included. Fix with
`npx prettier --write <files>`; don't reformat files a change doesn't touch.
