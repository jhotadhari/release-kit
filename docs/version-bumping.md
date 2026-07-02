# Version bumping

release-kit bumps version strings in files before committing and publishing.

## JSON files

Replace a key inside a JSON file:

```ts
bumpFiles: [
    { path: 'package.json', type: 'json', key: 'version' },
]
```

If `key` is omitted, it defaults to `'version'`. The file is read, the key is replaced, and the file is written back with 2-space indentation.

## Gradle files (Android)

For Android projects, release-kit bumps both `versionName` and `versionCode`:

```ts
bumpFiles: [
    { path: 'app/build.gradle', type: 'gradle' },
],
versionCode: {
    multiplier: {
        major: 10_000_000,
        minor:    100_000,
        patch:         1,
    },
    preReleaseOffsets: {
        alpha:   -100,
        beta:     -50,
        rc:       -10,
    },
},
```

### How versionCode is computed

The versionCode encodes the full semantic version into a single integer:

```
versionCode = major × multiplier.major
            + minor × multiplier.minor
            + patch × multiplier.patch
            + prerelease-offset
```

**Release versions** (no prerelease label) get a `+99` bonus, ensuring they sort higher than any prerelease from the same major.minor.patch:

```
1.0.0        → 1_000_000 + 99      = 1_000_099
1.0.0-alpha.1 → 1_000_000 - 100 + 1 =   999_901
1.0.0-beta.1  → 1_000_000 -  50 + 1 =   999_951
1.0.0-rc.1    → 1_000_000 -  10 + 1 =   999_991
```

This guarantees Google Play accepts the versionCode progression: `1.0.0-alpha.1` < `1.0.0-beta.1` < `1.0.0-rc.1` < `1.0.0` (release).

### Pre-release numbering limits

The prerelease number (e.g., the `1` in `alpha.1`) is clamped to a maximum of 32. This prevents overflow into other version components.

### Custom prerelease types

Add entries to `preReleaseOffsets` for any prerelease label:

```ts
preReleaseOffsets: {
    alpha:    -100,
    beta:     -50,
    rc:       -10,
    nightly:  -200,
    dev:      -150,
},
```

## Multiple bump files

Bump version in several files at once:

```ts
bumpFiles: [
    { path: 'package.json', type: 'json', key: 'version' },
    { path: 'package-lock.json', type: 'json', key: 'version' },
    { path: 'app/build.gradle', type: 'gradle' },
],
```
