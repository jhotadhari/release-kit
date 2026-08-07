import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { findAttachments } from '../src/github';

describe('findAttachments', () => {
	let tmpDir: string;

	before(() => {
		tmpDir = mkdtempSync(path.join(tmpdir(), 'release-kit-test-'));
	});

	after(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it('finds .apk files in android/app/build/outputs/apk/', async () => {
		const apkDir = path.join(
			tmpDir,
			'android/app/build/outputs/apk/release'
		);
		mkdirSync(apkDir, { recursive: true });
		writeFileSync(path.join(apkDir, 'app-release.apk'), 'fake-apk');

		const result = await findAttachments(tmpDir);
		assert.ok(result.some((f) => f.endsWith('app-release.apk')));
	});

	it('finds .aab files in android/app/build/outputs/bundle/', async () => {
		const bundleDir = path.join(
			tmpDir,
			'android/app/build/outputs/bundle/release'
		);
		mkdirSync(bundleDir, { recursive: true });
		writeFileSync(path.join(bundleDir, 'app-release.aab'), 'fake-aab');

		const result = await findAttachments(tmpDir);
		assert.ok(result.some((f) => f.endsWith('app-release.aab')));
	});

	it('finds .ipa files in ios/build/', async () => {
		const iosDir = path.join(tmpDir, 'ios/build');
		mkdirSync(iosDir, { recursive: true });
		writeFileSync(path.join(iosDir, 'App.ipa'), 'fake-ipa');

		const result = await findAttachments(tmpDir);
		assert.ok(result.some((f) => f.endsWith('App.ipa')));
	});

	it('matches extensions case-insensitively', async () => {
		const apkDir = path.join(
			tmpDir,
			'android/app/build/outputs/apk/release'
		);
		mkdirSync(apkDir, { recursive: true });
		writeFileSync(path.join(apkDir, 'App.APK'), 'fake-apk');

		const result = await findAttachments(tmpDir);
		assert.ok(result.some((f) => f.endsWith('App.APK')));
	});

	it('returns empty array when no candidate dirs exist', async () => {
		const emptyDir = mkdtempSync(
			path.join(tmpdir(), 'release-kit-empty-')
		);
		try {
			const result = await findAttachments(emptyDir);
			assert.deepEqual(result, []);
		} finally {
			rmSync(emptyDir, { recursive: true, force: true });
		}
	});

	it('does not match files with non-matching extensions', async () => {
		const apkDir = path.join(
			tmpDir,
			'android/app/build/outputs/apk/release'
		);
		mkdirSync(apkDir, { recursive: true });
		writeFileSync(path.join(apkDir, 'output.txt'), 'not-an-apk');
		writeFileSync(path.join(apkDir, 'output.json'), 'not-an-apk');

		const result = await findAttachments(tmpDir);
		assert.ok(!result.some((f) => f.endsWith('.txt')));
		assert.ok(!result.some((f) => f.endsWith('.json')));
	});
});
