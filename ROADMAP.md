# Roadmap

- **Store metadata scaffolding** — Generate Fastlane-compatible directory structure (`title.txt`, descriptions, screenshots, changelogs) that both Play Store and F-Droid consume.
- **Store changelog extraction** — Extract release notes from the changelog and truncate to per-store character limits (e.g. 500 chars for Play Store).
- **F-Droid repo generation** — Build an F-Droid repo index from GitHub Release APK artifacts, publishable via GitHub Pages.
- **Play Store upload** — Direct AAB upload to Play Console testing tracks via Fastlane Supply or Gradle Play Publisher.
