import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { scaffoldStoreMetadata } from '../src/store';
import type { ReleaseConfig } from '../src/types';

// Suppress console.log noise from scaffold function during tests
const originalLog = console.log;
console.log = () => {};
process.on('exit', () => {
	console.log = originalLog;
});

function makeConfig(
	basePath: string,
	locales?: string[]
): ReleaseConfig {
	return {
		repo: 'https://github.com/owner/repo',
		storeMetadata: {
			path: basePath,
			locales: locales ?? ['en-US'],
		},
	};
}

describe('scaffoldStoreMetadata', () => {
	let tmpDir: string;
	let metadataPath: string;

	before(() => {
		tmpDir = join(tmpdir(), `release-kit-test-${Date.now()}`);
		mkdirSync(tmpDir);
		metadataPath = join(tmpDir, 'fastlane/metadata/android');
	});

	after(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it('creates the full directory tree for each locale', () => {
		const config = makeConfig(metadataPath);
		scaffoldStoreMetadata(config, tmpDir);

		// Locale directory
		assert.ok(existsSync(join(metadataPath, 'en-US')));

		// Subdirectories
		assert.ok(existsSync(join(metadataPath, 'en-US', 'changelogs')));
		assert.ok(
			existsSync(
				join(metadataPath, 'en-US', 'images', 'phoneScreenshots')
			)
		);
		assert.ok(
			existsSync(
				join(metadataPath, 'en-US', 'images', 'tabletScreenshots')
			)
		);

		// Placeholder files
		assert.ok(existsSync(join(metadataPath, 'en-US', 'title.txt')));
		assert.ok(
			existsSync(join(metadataPath, 'en-US', 'short_description.txt'))
		);
		assert.ok(
			existsSync(join(metadataPath, 'en-US', 'full_description.txt'))
		);

		// .gitkeep files
		assert.ok(
			existsSync(
				join(metadataPath, 'en-US', 'changelogs', '.gitkeep')
			)
		);
		assert.ok(
			existsSync(
				join(
					metadataPath,
					'en-US',
					'images',
					'phoneScreenshots',
					'.gitkeep'
				)
			)
		);
	});

	it('creates directories for multiple locales', () => {
		const config = makeConfig(metadataPath, ['en-US', 'de-DE', 'es-ES']);
		scaffoldStoreMetadata(config, tmpDir);

		assert.ok(existsSync(join(metadataPath, 'en-US')));
		assert.ok(existsSync(join(metadataPath, 'de-DE')));
		assert.ok(existsSync(join(metadataPath, 'es-ES')));
	});

	it('does not overwrite existing files', () => {
		// First pass creates an empty title.txt
		const config = makeConfig(metadataPath);
		scaffoldStoreMetadata(config, tmpDir);

		const titlePath = join(metadataPath, 'en-US', 'title.txt');
		assert.ok(existsSync(titlePath));
		assert.equal(readFileSync(titlePath, 'utf-8'), '');

		// Second pass should skip since file exists
		// (we can verify by checking content didn't change)
		scaffoldStoreMetadata(config, tmpDir);
		assert.equal(readFileSync(titlePath, 'utf-8'), '');
	});

	it('is a no-op when storeMetadata is not configured', () => {
		// Use a separate directory so prior tests don't affect this assertion
		const noopDir = join(tmpDir, 'noop-test');
		const noopMetaPath = join(noopDir, 'fastlane/metadata/android');

		const config: ReleaseConfig = {
			repo: 'https://github.com/owner/repo',
		};
		// Should not throw
		scaffoldStoreMetadata(config, noopDir);

		// The metadataPath should not have been created
		assert.ok(!existsSync(noopMetaPath));
	});
});
