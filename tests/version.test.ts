import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getGitHubReleaseFlags, getNpmTag, getVersionCode, getCurrentVersionFromFile } from '../src/version';
import type { VersionCodeConfig } from '../src/types';

describe('getNpmTag', () => {
	it('returns undefined for release versions', () => {
		assert.equal(getNpmTag('1.0.0'), undefined);
		assert.equal(getNpmTag('2.3.0'), undefined);
	});

	it('returns the prerelease label for prerelease versions', () => {
		assert.equal(getNpmTag('1.0.0-alpha.1'), 'alpha');
		assert.equal(getNpmTag('1.0.0-beta.1'), 'beta');
		assert.equal(getNpmTag('1.0.0-rc.1'), 'rc');
	});

	it('returns the prerelease label for dot-separated prereleases', () => {
		assert.equal(getNpmTag('1.0.0-alpha.1.0'), 'alpha');
	});
});

describe('getGitHubReleaseFlags', () => {
	it('flags prerelease versions as prerelease and not latest', () => {
		assert.deepEqual(getGitHubReleaseFlags('1.0.0-alpha.1'), {
			prerelease: true,
			make_latest: 'false',
		});
		assert.deepEqual(getGitHubReleaseFlags('5.0.0-beta.1'), {
			prerelease: true,
			make_latest: 'false',
		});
		assert.deepEqual(getGitHubReleaseFlags('1.0.0-rc.2'), {
			prerelease: true,
			make_latest: 'false',
		});
	});

	it('flags release versions as not prerelease and latest', () => {
		assert.deepEqual(getGitHubReleaseFlags('0.4.0'), {
			prerelease: false,
			make_latest: 'true',
		});
		assert.deepEqual(getGitHubReleaseFlags('5.0.0'), {
			prerelease: false,
			make_latest: 'true',
		});
	});

	it('treats invalid versions as releases', () => {
		assert.deepEqual(getGitHubReleaseFlags('not-a-version'), {
			prerelease: false,
			make_latest: 'true',
		});
	});
});

describe('getVersionCode', () => {
	const config: VersionCodeConfig = {
		multiplier: {
			major: 10_000_000,
			minor: 100_000,
			patch: 1,
		},
		preReleaseOffsets: {
			alpha: -100,
			beta: -50,
			rc: -10,
		},
	};

	it('computes versionCode for release versions with +99 bonus', () => {
		assert.equal(getVersionCode('1.0.0', config), 10_000_000 + 99);
		assert.equal(getVersionCode('2.3.1', config), 20_300_001 + 99);
	});

	it('computes versionCode for alpha prereleases', () => {
		// 1.0.0-alpha.1 = 10_000_000 + (-100) + 1 = 9_999_901
		assert.equal(getVersionCode('1.0.0-alpha.1', config), 10_000_000 - 100 + 1);
	});

	it('computes versionCode for beta prereleases', () => {
		// 1.0.0-beta.1 = 10_000_000 + (-50) + 1 = 9_999_951
		assert.equal(getVersionCode('1.0.0-beta.1', config), 10_000_000 - 50 + 1);
	});

	it('computes versionCode for rc prereleases', () => {
		// 1.0.0-rc.2 = 10_000_000 + (-10) + 2 = 9_999_992
		assert.equal(getVersionCode('1.0.0-rc.2', config), 10_000_000 - 10 + 2);
	});

	it('clamps prerelease number to max 32', () => {
		assert.equal(
			getVersionCode('1.0.0-rc.50', config),
			10_000_000 - 10 + 32,
		);
	});

	it('handles prerelease without a number', () => {
		// alpha with no number → prerelease[1] is undefined → Number(undefined) → NaN → Math.min(NaN, 32) → NaN
		// Hmm, actually this would be an edge case. Let's check...
		// Number(undefined || 0) = 0 because of the `|| 0` fallback
		assert.equal(
			getVersionCode('1.0.0-alpha', config),
			10_000_000 - 100 + 0,
		);
	});

	it('release versionCode is higher than all prereleases for same version', () => {
		const release = getVersionCode('1.0.0', config);
		const alpha1 = getVersionCode('1.0.0-alpha.32', config);
		const beta1 = getVersionCode('1.0.0-beta.32', config);
		const rc1 = getVersionCode('1.0.0-rc.32', config);

		assert.ok(release > alpha1, 'release should be > alpha');
		assert.ok(release > beta1, 'release should be > beta');
		assert.ok(release > rc1, 'release should be > rc');
	});

	it('versionCode ordering: alpha < beta < rc < release', () => {
		const alpha1 = getVersionCode('1.0.0-alpha.1', config);
		const beta1 = getVersionCode('1.0.0-beta.1', config);
		const rc1 = getVersionCode('1.0.0-rc.1', config);
		const release = getVersionCode('1.0.0', config);

		assert.ok(alpha1 < beta1, 'alpha < beta');
		assert.ok(beta1 < rc1, 'beta < rc');
		assert.ok(rc1 < release, 'rc < release');
	});
});

describe('getCurrentVersionFromFile', () => {
	let tmpDir: string;
	const originalExit = process.exit;
	const originalError = console.error;

	before(() => {
		tmpDir = join(tmpdir(), `release-kit-version-test-${Date.now()}`);
		mkdirSync(tmpDir);
		process.exit = ((code?: number) => {
			throw new Error(`process.exit(${code})`);
		}) as typeof process.exit;
		console.error = () => {};
	});

	after(() => {
		rmSync(tmpDir, { recursive: true, force: true });
		process.exit = originalExit;
		console.error = originalError;
	});

	function createFile(name: string, content: string): string {
		const path = join(tmpDir, name);
		writeFileSync(path, content, 'utf-8');
		return path;
	}

	it('reads the version from a JSON file', () => {
		const path = createFile(
			'package.json',
			'{"name": "x", "version": "1.2.3"}\n'
		);
		assert.equal(getCurrentVersionFromFile(path), '1.2.3');
	});

	it('reads versionName from a gradle file (double quotes)', () => {
		const path = createFile(
			'build.gradle',
			'android {\n    defaultConfig {\n        versionName "0.9.1"\n        versionCode 91\n    }\n}\n'
		);
		assert.equal(getCurrentVersionFromFile(path), '0.9.1');
	});

	it('reads versionName from a gradle file (single quotes)', () => {
		const path = createFile(
			'build.gradle',
			"android {\n    defaultConfig {\n        versionName '0.9.1'\n    }\n}\n"
		);
		assert.equal(getCurrentVersionFromFile(path), '0.9.1');
	});

	it('reads a prerelease versionName from a gradle file', () => {
		const path = createFile(
			'build.gradle',
			'versionName "1.0.0-beta.1"\n'
		);
		assert.equal(getCurrentVersionFromFile(path), '1.0.0-beta.1');
	});

	it('throws when no versionName exists in a gradle file', () => {
		const path = createFile('build.gradle', 'android {\n}\n');
		assert.throws(
			() => {
				getCurrentVersionFromFile(path);
			},
			{ message: /process.exit/ }
		);
	});
});
