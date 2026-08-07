# App-side release workflow (building native artifacts)

release-kit handles the **local** side of a release: version bumping, changelog,
git operations, pushing the `v<version>` tag, and creating the GitHub Release
(with the changelog section as its body). It can also attach pre-built assets
to that release.

What release-kit **cannot** do is build **native artifacts** — e.g. an Android
`*.apk` / `*.aab`, an iOS build, a desktop binary, or anything else that
requires a CI runner (JDK, Android SDK, Xcode, etc.). For apps that ship such
binaries, the consuming repo must provide a GitHub Actions workflow that
builds them and attaches them to the release.

## How the two halves fit together

| Side | Who | Responsibility |
|---|---|---|
| Local | `release-kit` (`npx release-kit <version>`) | Bump, changelog, merge to `main`, **push `v<version>` tag**, **create the GitHub Release** (changelog body) |
| CI | the app's `.github/workflows/release.yml` | Triggered by the `v*` tag → build native artifacts → **attach them to the release** |

release-kit pushes the tag (step 7 of its pipeline) and creates the GitHub
Release (step 8) — see [workflow.md](./workflow.md). The tag push is what
triggers the app's CI workflow.

## The race, and how to avoid it

release-kit pushes the `v*` tag **before** it creates the GitHub Release. So
when CI wakes up on the tag push, the release may not exist yet. The CI
workflow must therefore **create the release if it's missing** rather than
assuming it already exists. Use
[`softprops/action-gh-release`](https://github.com/softprops/action-gh-release),
which creates-or-updates the release for the tag and uploads files with retries
— race-free against release-kit's tag-then-create ordering.

> Do **not** use the older `joutvhu/get-release` + `actions/upload-release-asset`
> pair. `actions/upload-release-asset@v1` is deprecated, and `get-release` fails
> if the release hasn't been created yet (exactly the race above).

## Reference workflow (Android APK + AAB)

Drop this in the consuming app's repo as `.github/workflows/release.yml` and
adapt the build commands, asset names, and secrets to the project.

```yaml
name: Release CI

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build:
    permissions:
      contents: write
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: "8.9" # Quotes required to prevent YAML converting to number

      - name: Grant execute permission for gradlew
        run: chmod +x ./android/gradlew

      - name: Decode Keystore
        env:
          ENCODED_KEYSTORE: ${{ secrets.APP_KEYSTORE_BASE64 }}
          APP_KEYSTORE_PATH: ${{ secrets.APP_KEYSTORE_PATH }}
        run: |
          cd ./android
          echo -n "${ENCODED_KEYSTORE}" | base64 -d > "./app/${APP_KEYSTORE_PATH}"

      - name: Set output
        id: vars
        run: echo "tag=${GITHUB_REF#refs/*/}" >> $GITHUB_OUTPUT

      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: install dependencies
        run: yarn install --immutable

      - name: Build Release APK
        env:
          APP_KEYSTORE_PATH: ${{ secrets.APP_KEYSTORE_PATH }}
          APP_KEYSTORE_PASSWORD: ${{ secrets.APP_KEYSTORE_PASSWORD }}
          APP_KEY_PASSWORD: ${{ secrets.APP_KEY_PASSWORD }}
          APP_KEYSTORE_ALIAS: ${{ secrets.APP_KEYSTORE_ALIAS }}
        run: cd ./android && ./gradlew assembleRelease

      - name: Build Release AAB
        env:
          APP_KEYSTORE_PATH: ${{ secrets.APP_KEYSTORE_PATH }}
          APP_KEYSTORE_PASSWORD: ${{ secrets.APP_KEYSTORE_PASSWORD }}
          APP_KEY_PASSWORD: ${{ secrets.APP_KEY_PASSWORD }}
          APP_KEYSTORE_ALIAS: ${{ secrets.APP_KEYSTORE_ALIAS }}
        run: cd ./android && ./gradlew bundleRelease

      - name: Stage release artifacts
        env:
          TAG: ${{ steps.vars.outputs.tag }}
        run: |
          mkdir -p ./artifacts
          cp ./android/app/build/outputs/apk/release/app-release.apk "./artifacts/your-app_${TAG}.apk"
          cp ./android/app/build/outputs/bundle/release/app-release.aab "./artifacts/your-app_${TAG}.aab"

      # Attach the APK & AAB to the GitHub release that release-kit created.
      # softprops/action-gh-release creates the release if it doesn't exist yet
      # (and retries), so this is race-free against release-kit's tag-then-create
      # ordering. `body` is intentionally omitted so we don't clobber the changelog
      # body release-kit already wrote — we only attach the build artifacts.
      - name: Attach APK & AAB to GitHub release
        uses: softprops/action-gh-release@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ steps.vars.outputs.tag }}
          files: |
            ./artifacts/your-app_${{ steps.vars.outputs.tag }}.apk
            ./artifacts/your-app_${{ steps.vars.outputs.tag }}.aab
```

### Required repository secrets

| Secret | Purpose |
|---|---|
| `APP_KEYSTORE_BASE64` | Base64-encoded release keystore (`base64 < keystore.jks`) |
| `APP_KEYSTORE_PATH` | Path under `android/app/` where the decoded keystore is written |
| `APP_KEYSTORE_PASSWORD` | Keystore password |
| `APP_KEY_PASSWORD` | Key password |
| `APP_KEYSTORE_ALIAS` | Key alias |

`GITHUB_TOKEN` is provided automatically by Actions and needs no configuration;
the job only needs `permissions: contents: write`.

### Notes

- **`yarn install --immutable`** runs the project's `postinstall` (e.g.
  `patch-package`) automatically on CI — `--immutable` only freezes the
  lockfile, it does not disable scripts. Local patches are therefore applied
  in CI just like locally.
- **`body` omitted deliberately** — release-kit already wrote the changelog as
  the release body. `softprops/action-gh-release` only replaces fields you
  explicitly provide, so omitting `body` preserves it.
- **Asset naming** — `softprops/action-gh-release` uploads files under their
  basename, so the staging step renames `app-release.apk` →
  `your-app_<tag>.apk` first if you want a friendlier download name.
- For **non-Android** apps, keep the tag trigger + `softprops/action-gh-release`
  step and swap the build commands for whatever produces your binary.
