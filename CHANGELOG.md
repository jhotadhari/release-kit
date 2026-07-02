# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `--no-publish` CLI flag to skip publish steps at runtime (`--no-publish`, `--no-publish github`, `--no-publish npm`)
- Resume support: if the pipeline fails, re-running the same command picks up where it left off via `.release-kit-state.json`
- Pipeline steps now use string keys (`'bump'`, `'changelog'`, …) instead of fragile numeric identifiers, with legacy migration for existing state files

### Fixed

- `checkCleanWorkingTree` now guarded on resume: dirty bump/changelog files after a partial run no longer block recovery
- Branch-mismatch detection preserves state after `merge_main` — the branch change to `main` is expected and no longer clears the resume checkpoint
- `--no-publish` flags are now restored from saved state on resume (was saved but never read back, unlike `--no-test`/`--no-lint`)
- `save()` preserves `noTest`/`noLint` from existing state so flags survive across multiple crash-resume cycles
- State file writes are now atomic (temp file + rename) to prevent truncated state on crash
- `isCompleted` has a runtime guard for unknown step keys
- Legacy numeric step migration map is derived from `STEP_ORDER` so it stays in sync automatically
- `loadState` validates `version`/`releaseBranch` types and distinguishes JSON parse errors from I/O errors

## [0.0.3] - 2026-07-02

### Fixed

- `GITHUB_TOKEN` is now checked in pre-flight (step 2), before any mutations — no more mid-pipeline failures
- npm authentication is now checked in pre-flight (step 2), before any mutations
- `buildCommand` now defaults to `false` (skip build); packages that need a build step set `buildCommand: 'yarn prepare'` explicitly

## [0.0.2] - 2026-07-02

## [0.0.1] - 2026-07-02

### Added

- Initial release pipeline: version bumping, changelog management, git operations, GitHub Releases, npm publishing
- CLI with `--dry-run`, `--no-test`, `--no-lint` flags
- Version bumping for JSON (`package.json`) and Gradle (`build.gradle`) files
- Android `versionCode` computation from semver with prerelease ordering
- Comprehensive documentation
- Unit test suite

[Unreleased]: https://github.com/jhotadhari/release-kit/compare/v0.0.3...HEAD
[0.0.3]: https://github.com/jhotadhari/release-kit/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/jhotadhari/release-kit/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/jhotadhari/release-kit/releases/tag/v0.0.1
