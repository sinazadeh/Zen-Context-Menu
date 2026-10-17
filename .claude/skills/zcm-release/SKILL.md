---
name: zcm-release
description: Releasing a version of Zen Context Menu - theme.json version and updatedAt, the CHANGELOG.md section, and the chrome.css header the tests tie to them. Use when preparing a release or changing how versions are recorded.
---

# Releases

There's no release workflow: Sine users get a version when it reaches
`main` with a newer `updatedAt`.

1. Pick the version: patch for fixes, minor for anything added, major when
   users must act (version 5 needed JavaScript).
2. In `theme.json`, set `version` and `updatedAt` (`YYYY-MM-DD`, today).
3. In `CHANGELOG.md`, move the notes under `## [Unreleased]` into
   `## [<version>] - <date>` right below it, leaving `[Unreleased]` empty.
4. Set the version in the first line of `chrome.css`
   (`/* Zen Context Menu v<version>`).
5. Run the checks (`/zcm-check`); `tests/theme.test.mjs` fails if the three
   disagree.

Add user-visible changes to `[Unreleased]` as you make them, in the
`### Added` / `### Fixed` / `### Changed` / `### Removed` groups.
