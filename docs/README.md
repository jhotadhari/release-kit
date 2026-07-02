# release-kit

Generic release pipeline for libraries and apps — bumps versions, manages changelogs, publishes to npm and GitHub.

## Quick start

```sh
yarn add --dev @jhotadhari/release-kit
```

Create a `release.config.ts` in your project root:

```ts
import { defineConfig } from '@jhotadhari/release-kit';

export default defineConfig({
    repo: 'https://github.com/your-org/your-repo',
    bumpFiles: [
        { path: 'package.json', type: 'json', key: 'version' },
    ],
});
```

Create a `CHANGELOG.md` with an `[Unreleased]` section:

```md
# Changelog

## [Unreleased]
```

Cut a release from a `release/` branch:

```sh
git checkout development
git checkout -b release/1.2.0
npx release-kit 1.2.0
```

## How it works

release-kit automates a full release pipeline in a single command:

1. **Validates** pre-conditions (clean tree, correct branch, changelog has `[Unreleased]`, version is higher, typecheck/lint/tests pass)
2. **Bumps** version strings in configured files (JSON, Gradle)
3. **Releases** the changelog — dates and renames `[Unreleased]` to the new version
4. **Commits** the changes on the release branch
5. **Merges** to `main` (no-fast-forward), tags, and pushes
6. **Creates** a GitHub Release from the changelog section
7. **Publishes** to npm (optional, with auto-detected dist-tag for prereleases)
8. **Merges** back to `development`
9. **Re-adds** a fresh `[Unreleased]` section to the changelog

Run with `--dry-run` to validate without making any changes.
