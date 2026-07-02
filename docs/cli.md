# CLI reference

```
npx release-kit <version> [options]
```

## Arguments

| Argument | Required | Description |
|---|---|---|
| `<version>` | Yes | SemVer version to publish (e.g., `1.0.0`, `1.0.0-alpha.1`) |

## Options

| Option | Default | Description |
|---|---|---|
| `--dry-run` | `false` | Run all pre-flight validations but skip mutations. Use before a real release to check everything passes. |
| `--no-test` | `false` | Skip the test preflight check. |
| `--no-lint` | `false` | Skip the lint preflight check. |

## Environment variables

| Variable | Required for | Description |
|---|---|---|
| `GITHUB_TOKEN` | GitHub Releases | GitHub personal access token with `repo` scope. Can be obtained via `gh auth token` (GitHub CLI) or from https://github.com/settings/tokens |
| `NODE_AUTH_TOKEN` | npm publish | If publishing to npm with a registry that requires authentication (set automatically by `setup-node` in CI) |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Validation failure or command error |

## Examples

```sh
# Dry-run a patch release
npx release-kit 0.1.1 --dry-run

# Publish a minor release
npx release-kit 0.2.0

# Publish an alpha prerelease, skipping tests
npx release-kit 1.0.0-alpha.1 --no-test

# Publish with GITHUB_TOKEN from gh CLI
export GITHUB_TOKEN=$(gh auth token)
npx release-kit 1.0.0
```
