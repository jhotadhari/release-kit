import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadState, saveState, clearState, type PipelineState } from '../src/state';

let tmpDir: string;

before(() => {
	tmpDir = join(tmpdir(), `release-kit-test-state-${Date.now()}`);
	mkdirSync(tmpDir, { recursive: true });
});

after(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

describe('loadState', () => {
	it('returns null when no state file exists', () => {
		assert.equal(loadState(tmpDir), null);
	});

	it('loads a valid state file', () => {
		const state: PipelineState = {
			version: '0.0.3',
			completedStep: 7,
			releaseBranch: 'release/0.0.3',
		};
		saveState(tmpDir, state);
		const loaded = loadState(tmpDir);
		assert.ok(loaded);
		assert.equal(loaded!.version, '0.0.3');
		assert.equal(loaded!.completedStep, 7);
		assert.equal(loaded!.releaseBranch, 'release/0.0.3');
	});

	it('loads state with optional fields', () => {
		const state: PipelineState = {
			version: '0.0.4',
			completedStep: 9,
			releaseBranch: 'release/0.0.4',
			noPublish: ['github'],
			noTest: true,
			noLint: false,
		};
		saveState(tmpDir, state);
		const loaded = loadState(tmpDir);
		assert.ok(loaded);
		assert.deepEqual(loaded!.noPublish, ['github']);
		assert.equal(loaded!.noTest, true);
		assert.equal(loaded!.noLint, false);
	});

	it('returns null for invalid JSON', () => {
		writeFileSync(
			join(tmpDir, '.release-kit-state.json'),
			'not json',
			'utf-8'
		);
		assert.equal(loadState(tmpDir), null);
	});

	it('returns null when version is missing', () => {
		writeFileSync(
			join(tmpDir, '.release-kit-state.json'),
			JSON.stringify({ completedStep: 4, releaseBranch: 'release/x' }),
			'utf-8'
		);
		assert.equal(loadState(tmpDir), null);
	});

	it('returns null when completedStep is out of range', () => {
		saveState(tmpDir, {
			version: '1.0.0',
			completedStep: 12,
			releaseBranch: 'release/1.0.0',
		});
		assert.equal(loadState(tmpDir), null);

		saveState(tmpDir, {
			version: '1.0.0',
			completedStep: 3,
			releaseBranch: 'release/1.0.0',
		});
		assert.equal(loadState(tmpDir), null);
	});
});

describe('saveState', () => {
	it('writes a valid JSON file', () => {
		const state: PipelineState = {
			version: '1.0.0',
			completedStep: 5,
			releaseBranch: 'release/1.0.0',
		};
		saveState(tmpDir, state);
		const loaded = loadState(tmpDir);
		assert.ok(loaded);
		assert.equal(loaded!.version, '1.0.0');
	});
});

describe('clearState', () => {
	it('removes the state file', () => {
		saveState(tmpDir, {
			version: '2.0.0',
			completedStep: 8,
			releaseBranch: 'release/2.0.0',
		});
		assert.ok(loadState(tmpDir));
		clearState(tmpDir);
		assert.equal(loadState(tmpDir), null);
	});

	it('is a no-op when no state file exists', () => {
		// Should not throw
		clearState(tmpDir);
		assert.equal(loadState(tmpDir), null);
	});
});
