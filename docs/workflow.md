# Branching model and release workflow

## Branch structure

```
main           ← releases only (no direct commits)
  └─ development ← active development, feature branches target this
       └─ release/<version> ← cut from development for each release
```

- **`main`** — Only release commits. release-kit merges here automatically.
- **`development`** — Ongoing work. All feature branches and PRs target this branch.
- **`release/<version>`** — Temporary branch where release-kit runs. Created from `development`, merged into `main` and back into `development` by release-kit.

## Cutting a release

### 1. Ensure the changelog is up to date

Before cutting a release, add your changes under the `[Unreleased]` section in `CHANGELOG.md`:

```md
# Changelog

## [Unreleased]
### Added
- New feature X
### Fixed
- Bug Y
```

### 2. Create a release branch

```sh
git checkout development
git pull
git checkout -b release/1.2.0
```

### 3. Run release-kit

```sh
# Dry-run first to validate
npx release-kit 1.2.0 --dry-run

# If everything passes, run for real
npx release-kit 1.2.0
```

### 4. What happens automatically

| Step | Action |
|---|---|
| Pre-flight | Validates clean tree, correct branch, `[Unreleased]` exists, version > current, typecheck/lint/tests pass |
| Bump | Updates version in configured files (`package.json`, `build.gradle`, etc.) |
| Changelog | Renames `[Unreleased]` → `[1.2.0]` with today's date |
| Commit | `chore: release v1.2.0` on `release/1.2.0` |
| Merge | No-fast-forward merge into `main` |
| Tag | Creates and pushes `v1.2.0` tag |
| GitHub | Creates a GitHub Release with the changelog section as body |
| npm | Runs build command, then `npm publish` (with dist-tag for prereleases) |
| Merge back | No-fast-forward merge into `development` |
| Changelog | Re-adds a blank `[Unreleased]` section, commits and pushes |

### 5. Clean up

The `release/1.2.0` branch can be deleted after a successful release:

```sh
git branch -d release/1.2.0
```

## Prereleases

Release alpha, beta, or rc versions with semver prerelease syntax:

```sh
npx release-kit 1.2.0-alpha.1
npx release-kit 1.2.0-beta.1
npx release-kit 1.2.0-rc.1
```

npm dist-tags are auto-detected from the prerelease label: `alpha`, `beta`, `rc`, etc. This means `npm publish --tag alpha` is used for `1.2.0-alpha.1`, preventing accidental `latest` tagging.

## Skipping preflight checks

```sh
npx release-kit 1.2.0 --no-test   # skip tests
npx release-kit 1.2.0 --no-lint   # skip lint
npx release-kit 1.2.0 --dry-run   # validate only, no mutations
```
