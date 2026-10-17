---
name: zcm-release
description: Releasing a version of Zen Calmer Context Menu - theme.json version and updatedAt, the CHANGELOG.md section, the chrome.css header the tests tie to them, and the Release workflow that publishes GitHub releases (including backfills). Use when preparing a release, restructuring CHANGELOG.md, or changing scripts/publish_releases.mjs or .github/workflows/release.yml.
---

# Releases

1. Pick the version: patch for fixes, minor for anything added, major when
   users must act (version 5 needed JavaScript).
2. In `theme.json`, set `version`, and `updatedAt` to the current UTC time
   (`YYYY-MM-DDTHH:MM:SSZ`). Sine offers an update only when `updatedAt` is
   newer than the installed copy's, so a date alone isn't enough for two
   releases on one day.
3. In `CHANGELOG.md`, move the notes under `## [Unreleased]` into
   `## [<version>] - <date>` right below it (the same UTC date), leaving
   `[Unreleased]` empty.
4. Set the version in the first line of `chrome.css`
   (`/* Zen Calmer Context Menu v<version>`).
5. Run the checks (`/zcm-check`); `tests/theme.test.mjs` fails if the three
   disagree.

Sine users get the version when it reaches `main`. The **Release** workflow
runs whenever `theme.json` changes on `main` and publishes a GitHub release,
tag `v<version>`, for every version that doesn't have one yet
(`scripts/publish_releases.mjs`), with that version's changelog section and
a zip of `context-menu.uc.js`, `context-menu/` and `chrome.css` at the
release's commit for fx-autoconfig users. 3.1, KiKaraage's version as
imported, isn't released (`FIRST_VERSION`).

There's no tag to push, except for a version released at an older commit
than `main`'s (a backfill): GitHub won't let the workflow's token create a
tag at a commit whose `.github/workflows` differ from `main`'s (HTTP 403),
so the run publishes what it can and prints the `git tag`/`git push`
commands for the rest. A version's release commit is the first commit on
`main`'s first-parent line with that version and its notes, with nothing
left under `[Unreleased]`; an existing tag is kept. Deleting a release gets
it published again on the next run, so delete its tag too, or keep the
release. `node scripts/publish_releases.mjs --dry-run` shows what would be
published; pull requests touching the script or workflow run that too.

Add user-visible changes to `[Unreleased]` as you make them, in the
`### Added` / `### Fixed` / `### Changed` / `### Removed` groups.
