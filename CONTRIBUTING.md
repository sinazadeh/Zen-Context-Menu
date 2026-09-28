# Contributing

Thanks for helping keep Zen Context Menu working.

## Development model

- The mod is a single style sheet, `chrome.css`, with its options in
  `preferences.json`. There's no build step and no JavaScript in the mod.
- `theme.json` is the manifest [Sine](https://github.com/CosmoCreeper/Sine)
  reads when installing from this repository.
- The repository intentionally does not track a `package.json` or lockfile.
  Install development tools ad hoc when you need them.

## Local setup

From the repository root:

```sh
npm install --no-save --package-lock=false eslint@9.7.0 @eslint/js@9.7.0 globals@15 prettier@3.9.9
```

## Checks

Run the checks relevant to your changes:

```sh
node --test "tests/*.test.mjs"
npx prettier --check "**/*.{css,mjs,md,json,yml}"
npx eslint .
git diff --check
```

If you changed `chrome.css`, also check it against current Zen and Firefox
sources, and in the real menus of the latest Zen (both need git and network
access; the second downloads Zen for Linux into `.cache/` and runs it
headless):

```sh
node scripts/check_selector_targets.mjs release dev
MOZ_HEADLESS=1 node scripts/check_menus.mjs
```

`check_menus.mjs --only=uc.hidecontext.<name>` checks a single option.

## Manual browser validation

The menu check only runs on Linux and doesn't look at how menus look. For
changes to `chrome.css`, check the affected menus in Zen with the option on
and off; `AGENTS.md` ("Manual browser validation") lists the menus and cases
worth covering. Look out for two separators next to each other or one at the
top or bottom of a menu.

Record the Zen version (`about:support`), operating system and the menus you
actually checked in the pull request.

## Pull requests

- Keep changes focused and avoid unrelated reformatting.
- Don't rename existing preferences: people coming from the theme store
  version keep their settings because the names match.
- Update `README.md` when options or installation steps change, and add a
  `CHANGELOG.md` entry.
- Mention any checks or menus you could not verify.
- See `AGENTS.md` for how the mod is put together and its sensitive areas.
