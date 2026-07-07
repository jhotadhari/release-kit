# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Edit Tool - Whitespace Workaround

For `.ts`/`.tsx`/`.js`/`.jsx` files: match `old_string` in Edit calls **without** leading
whitespace (to avoid the tab-vs-space ambiguity described in
[claude-code/#26996](https://github.com/anthropics/claude-code/issues/26996)). Accumulate all
touched files, then run one `npx prettier --write <file1> <file2> ...` at the end to fix
indentation. Only include leading whitespace when needed to disambiguate non-unique matches.

For `.java` files, `yarn format` doesn't cover them — fall back to `sed` with explicit `\t`
escapes after a single failed Edit attempt.

## Commands

```sh
yarn typecheck       # TypeScript type-checking (tsc --noEmit)
yarn lint            # ESLint across all js/ts/tsx files
yarn format          # Prettier — formats all files in place
```

There is no build step — the package runs directly via `tsx`. The `bin/release-kit.js` CJS bootstrap uses `tsx/cjs/api` to load TS modules at runtime.

## Architecture

`release-kit` is a **generic release pipeline CLI** consumed by other projects. It is not run from this repo directly; it is installed as a dependency and invoked via `npx release-kit <version>` from the consuming project's root.

**Entry point**: `bin/release-kit.js` — a CJS bootstrap that `tsx.require()` loades the consumer's `release.config.ts` from `cwd`, then calls `release(config)` from `src/index.ts`.

**Core orchestrator**: `src/index.ts` → `release()` runs an 11-step linear pipeline, documented inline. Each step delegates to a domain module:

| Module | Responsibility |
|---|---|
| `src/cli.ts` | Parses `<version>` (semver) + `--dry-run`, `--no-test`, `--no-lint` via commander |
| `src/config.ts` | Merges consumer config with defaults (branch names, bump file paths, preflight commands, publish targets) and resolves relative paths to absolute |
| `src/checks.ts` | Pre-flight validations: version > current, clean git tree, `[Unreleased]` in changelog, branch name matches `releasePrefix`, runs typecheck/lint/test |
| `src/version.ts` | Bumps versions in JSON files (key-based) and Gradle files (`versionName` + computed `versionCode`). Also derives npm dist-tags from semver prerelease labels |
| `src/changelog.ts` | Wraps `keep-a-changelog` — parses, releases `[Unreleased]` → dated version, re-adds a blank `[Unreleased]`, and extracts a release's body for GitHub |
| `src/git.ts` | All git mutations via `simple-git`: stage + commit, `--no-ff` merges to main and development, tag + push |
| `src/github.ts` | Creates or updates a GitHub Release via `@octokit/rest`. Parses owner/repo from the `repo` URL. Requires `GITHUB_TOKEN` env var |
| `src/npm.ts` | Runs the build command (default `false` = skip) then `npm publish` with an auto-detected dist-tag for prereleases |
| `src/state.ts` | Pipeline state persistence: `loadState`, `saveState`, `clearState`, `isCompleted`, `nextStep`, `STEP_ORDER`. Supports resume-on-failure via `.release-kit-state.json`. |

**Config shape** (`src/types.ts`): Consumers define a `ReleaseConfig` via `defineConfig()` re-exported from the package. Key knobs: `bumpFiles` (JSON or Gradle), `versionCode` (multipliers for Android versionCode computation), `branches` (main/development/release prefix), `publish` (npm and/or GitHub), `preflight` (customizable typecheck/lint/test commands).

**The pipeline** (dry-run exits after step 3):
1. Parse CLI args
2. Pre-flight validations
3. _(dry-run exit point)_
4. Bump version in all configured files
5. Release changelog section
6. Git commit on release branch
7. Merge to main → tag → push
8. Create/update GitHub Release
9. Build + npm publish (if configured)
10. Merge to development
11. Re-add `[Unreleased]` to changelog, commit, push
