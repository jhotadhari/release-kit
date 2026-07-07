import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/config';

describe('resolveConfig', () => {
	const cwd = '/fake/project';

	it('applies all defaults when given minimal config', () => {
		const result = resolveConfig(cwd, {
			repo: 'https://github.com/owner/repo',
		});

		assert.equal(result.repo, 'https://github.com/owner/repo');
		assert.deepEqual(result.branches, {
			main: 'main',
			development: 'development',
			releasePrefix: 'release',
		});
		assert.deepEqual(result.bumpFiles, [
			{ path: '/fake/project/package.json', type: 'json', key: 'version' },
		]);
		assert.equal(result.changelog?.path, '/fake/project/CHANGELOG.md');
		assert.deepEqual(result.publish, { npm: false, github: true });
		assert.deepEqual(result.preflight, {
			typecheck: 'yarn typecheck',
			lint: 'yarn lint',
			test: 'yarn test',
		});
	});

	it('merges user branch config with defaults', () => {
		const result = resolveConfig(cwd, {
			repo: 'owner/repo',
			branches: { main: 'master' },
		});

		assert.deepEqual(result.branches, {
			main: 'master',
			development: 'development',
			releasePrefix: 'release',
		});
	});

	it('merges user preflight config with defaults', () => {
		const result = resolveConfig(cwd, {
			repo: 'owner/repo',
			preflight: { lint: false },
		});

		assert.deepEqual(result.preflight, {
			typecheck: 'yarn typecheck',
			lint: false,
			test: 'yarn test',
		});
	});

	it('preserves versionCode when provided', () => {
		const vc = {
			multiplier: { major: 100, minor: 10, patch: 1 },
		};
		const result = resolveConfig(cwd, {
			repo: 'owner/repo',
			versionCode: vc,
		});

		assert.deepEqual(result.versionCode, vc);
	});

	it('resolves relative bump file paths to absolute', () => {
		const result = resolveConfig(cwd, {
			repo: 'owner/repo',
			bumpFiles: [
				{ path: 'sub/package.json', type: 'json' },
			],
		});

		assert.equal(result.bumpFiles![0]!.path, '/fake/project/sub/package.json');
	});

	it('resolves changelog path to absolute', () => {
		const result = resolveConfig(cwd, {
			repo: 'owner/repo',
			changelog: { path: 'docs/CHANGES.md' },
		});

		assert.equal(result.changelog!.path, '/fake/project/docs/CHANGES.md');
	});

	it('does not set versionCode when not provided', () => {
		const result = resolveConfig(cwd, {
			repo: 'owner/repo',
		});

		assert.equal(result.versionCode, undefined);
	});

	it('handles npm publish config as object', () => {
		const result = resolveConfig(cwd, {
			repo: 'owner/repo',
			publish: {
				npm: { buildCommand: 'npm run build' },
			},
		});

		assert.deepEqual(result.publish!.npm, { buildCommand: 'npm run build' });
	});

	it('applies default storeMetadata config', () => {
	const result = resolveConfig(cwd, {
		repo: 'owner/repo',
	});

	assert.deepEqual(result.storeMetadata, {
		path: '/fake/project/fastlane/metadata/android',
		locales: ['en-US'],
	});
});

it('merges user storeMetadata with defaults', () => {
	const result = resolveConfig(cwd, {
		repo: 'owner/repo',
		storeMetadata: { locales: ['en-US', 'de-DE'] },
	});

	assert.equal(
		result.storeMetadata!.path,
		'/fake/project/fastlane/metadata/android'
	);
	assert.deepEqual(result.storeMetadata!.locales, ['en-US', 'de-DE']);
});

it('resolves storeMetadata path to absolute', () => {
	const result = resolveConfig(cwd, {
		repo: 'owner/repo',
		storeMetadata: { path: 'custom/store/path' },
	});

	assert.equal(
		result.storeMetadata!.path,
		'/fake/project/custom/store/path'
	);
});

it('handles npm publish config as boolean', () => {
		const result = resolveConfig(cwd, {
			repo: 'owner/repo',
			publish: { npm: true },
		});

		assert.equal(result.publish!.npm, true);
	});

	it('handles github publish config as object with attachment', () => {
		const result = resolveConfig(cwd, {
			repo: 'owner/repo',
			publish: {
				github: { attachment: true },
			},
		});

		assert.deepEqual(result.publish!.github, { attachment: true });
	});

	it('handles github publish config as boolean false', () => {
		const result = resolveConfig(cwd, {
			repo: 'owner/repo',
			publish: {
				github: false,
			},
		});

		assert.equal(result.publish!.github, false);
	});

	it('handles github publish config as boolean true', () => {
		const result = resolveConfig(cwd, {
			repo: 'owner/repo',
			publish: { github: true },
		});

		assert.equal(result.publish!.github, true);
	});
});
