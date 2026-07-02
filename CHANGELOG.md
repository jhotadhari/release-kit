# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
