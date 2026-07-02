# Configuration

`release.config.ts` exports a `ReleaseConfig` object via the `defineConfig` helper (provides type-checking).

## Full schema

```ts
interface ReleaseConfig {
    repo: string;                              // required
    branches?: {
        main?: string;                         // default: 'main'
        development?: string;                  // default: 'development'
        releasePrefix?: string;                // default: 'release'
    };
    bumpFiles?: BumpFile[];                    // default: [{ path: 'package.json', type: 'json', key: 'version' }]
    changelog?: {                              // set to false to disable changelog management
        path?: string;                         // default: 'CHANGELOG.md'
    };
    publish?: {
        npm?: boolean | {                     // default: false
            buildCommand?: string | false;    // default: false (skip build)
        };
        github?: boolean;                     // default: true
    };
    versionCode?: VersionCodeConfig;          // required only for Gradle bumpFiles
    preflight?: {
        typecheck?: string | false;           // default: 'yarn typecheck'
        lint?: string | false;                // default: 'yarn lint'
        test?: string | false;                // default: 'yarn test'
    };
}
```

## `BumpFile`

```ts
interface BumpFile {
    path: string;                             // relative to project root
    type: 'json' | 'gradle';
    key?: string;                             // JSON key to bump (default: 'version')
}
```

## `VersionCodeConfig`

Used to compute Android `versionCode` from a semver version. See [Version bumping](./version-bumping.md) for details.

```ts
interface VersionCodeConfig {
    multiplier: {
        major: number;
        minor: number;
        patch: number;
    };
    preReleaseOffsets?: Record<string, number>;
}
```

## Defaults

| Key | Default |
|---|---|
| `branches.main` | `'main'` |
| `branches.development` | `'development'` |
| `branches.releasePrefix` | `'release'` |
| `bumpFiles` | `[{ path: 'package.json', type: 'json', key: 'version' }]` |
| `changelog.path` | `'CHANGELOG.md'` |
| `publish.npm` | `false` |
| `publish.github` | `true` |
| `preflight.typecheck` | `'yarn typecheck'` |
| `preflight.lint` | `'yarn lint'` |
| `preflight.test` | `'yarn test'` |

Disable any preflight check by setting it to `false`:

```ts
export default defineConfig({
    repo: 'https://github.com/your-org/your-repo',
    preflight: {
        typecheck: 'yarn tsc --noEmit',   // custom command
        lint: false,                       // disabled
        test: 'yarn test --coverage',      // custom command
    },
});
```
