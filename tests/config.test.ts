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

	it('handles npm publish config as boolean', () => {
		const result = resolveConfig(cwd, {
			repo: 'owner/repo',
			publish: { npm: true },
		});

		assert.equal(result.publish!.npm, true);
	});
});
