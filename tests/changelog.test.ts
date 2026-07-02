import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	readChangelog,
	writeChangelog,
	releaseChangelog,
	addUnreleasedSection,
	extractReleaseBody,
} from '../src/changelog';

const repoUrl = 'https://github.com/owner/repo';
let tmpDir: string;

function createChangelog(content: string, dir?: string): string {
	const base = dir ?? tmpDir;
	const path = join(base, 'CHANGELOG.md');
	writeFileSync(path, content, 'utf-8');
	return path;
}

describe('readChangelog', () => {
	before(() => {
		tmpDir = join(tmpdir(), `release-kit-test-${Date.now()}`);
		mkdirSync(tmpDir);
	});

	after(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it('parses a changelog with an unreleased section', () => {
		const path = createChangelog(
			'# Changelog\n\n## [Unreleased]\n### Added\n- New feature\n',
		);

		const changelog = readChangelog(path);
		const unreleased = changelog.releases.find((r) => !r.version);
		assert.ok(unreleased);
		assert.equal(unreleased!.version, undefined);
	});

	it('parses a changelog with released versions', () => {
		const path = createChangelog(
			'# Changelog\n\n## [1.0.0] - 2024-01-15\n### Added\n- Initial release\n',
		);

		const changelog = readChangelog(path);
		const release = changelog.findRelease('1.0.0');
		assert.ok(release);
		assert.equal(release!.version, '1.0.0');
	});
});

describe('releaseChangelog', () => {
	before(() => {
		tmpDir = join(tmpdir(), `release-kit-test-${Date.now()}`);
		mkdirSync(tmpDir);
	});

	after(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it('renames [Unreleased] to the given version with a date', () => {
		const path = createChangelog(
			'# Changelog\n\n## [Unreleased]\n### Added\n- New feature\n',
		);

		releaseChangelog('1.2.0', path, repoUrl);

		const content = readFileSync(path, 'utf-8');
		assert.ok(content.includes('[1.2.0]'));
		assert.ok(!content.includes('[Unreleased]'));
	});
});

describe('addUnreleasedSection', () => {
	before(() => {
		tmpDir = join(tmpdir(), `release-kit-test-${Date.now()}`);
		mkdirSync(tmpDir);
	});

	after(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it('adds a new [Unreleased] section after a release', () => {
		const path = createChangelog(
			'# Changelog\n\n## [1.0.0] - 2024-01-15\n### Added\n- Initial release\n',
		);

		addUnreleasedSection(path, repoUrl);

		const content = readFileSync(path, 'utf-8');
		// Should have both the old release and a new Unreleased
		assert.ok(content.includes('[1.0.0]'));
		assert.ok(
			content.includes('[Unreleased]'),
			'Should have an [Unreleased] section',
		);
		// Unreleased should come before 1.0.0 (newer first with autoSortReleases)
		const unreleasedIndex = content.indexOf('[Unreleased]');
		const versionIndex = content.indexOf('[1.0.0]');
		assert.ok(unreleasedIndex < versionIndex, '[Unreleased] should be before [1.0.0]');
	});
});

describe('extractReleaseBody', () => {
	before(() => {
		tmpDir = join(tmpdir(), `release-kit-test-${Date.now()}`);
		mkdirSync(tmpDir);
	});

	after(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it('extracts the body of a released version', () => {
		const path = createChangelog(
			[
				'# Changelog',
				'',
				'## [1.0.0] - 2024-01-15',
				'',
				'Initial release description.',
				'',
				'### Added',
				'- Feature A [#123](https://github.com/owner/repo/issues/123)',
				'',
				'### Fixed',
				'- Bug B',
				'',
			].join('\n'),
		);

		const body = extractReleaseBody('1.0.0', path);

		assert.ok(body.includes('Initial release description.'));
		assert.ok(body.includes('### Added'));
		assert.ok(body.includes('Feature A'));
		assert.ok(body.includes('### Fixed'));
		assert.ok(body.includes('Bug B'));
	});

	it('extracts body without description', () => {
		const path = createChangelog(
			[
				'# Changelog',
				'',
				'## [1.0.0] - 2024-01-15',
				'### Changed',
				'- Some change',
				'',
			].join('\n'),
		);

		const body = extractReleaseBody('1.0.0', path);

		assert.ok(body.includes('### Changed'));
		assert.ok(body.includes('Some change'));
	});
});

describe('writeChangelog', () => {
	it('sets the repo URL and markdownlint format on the changelog object', () => {
		const dir = join(tmpdir(), `release-kit-test-${Date.now()}`);
		mkdirSync(dir);

		try {
			const path = createChangelog(
				'# Changelog\n\n## [Unreleased]\n',
				dir,
			);
			const changelog = readChangelog(path);
			writeChangelog(changelog, path, repoUrl);

			assert.equal(changelog.url, repoUrl);
			assert.equal(changelog.format, 'markdownlint');

			// File should be written (not empty)
			const content = readFileSync(path, 'utf-8');
			assert.ok(content.length > 0);
			assert.ok(content.includes('Unreleased'));
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
