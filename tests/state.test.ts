import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	loadState,
	saveState,
	clearState,
	isCompleted,
	nextStep,
	type PipelineState,
	STEP_ORDER,
} from '../src/state';

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
			completedStep: 'merge_main',
			releaseBranch: 'release/0.0.3',
		};
		saveState(tmpDir, state);
		const loaded = loadState(tmpDir);
		assert.ok(loaded);
		assert.equal(loaded!.version, '0.0.3');
		assert.equal(loaded!.completedStep, 'merge_main');
		assert.equal(loaded!.releaseBranch, 'release/0.0.3');
	});

	it('loads state with optional fields', () => {
		const state: PipelineState = {
			version: '0.0.4',
			completedStep: 'npm_publish',
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

	it('migrates legacy numeric completedStep to string key', () => {
		writeFileSync(
			join(tmpDir, '.release-kit-state.json'),
			JSON.stringify({
				version: '0.0.4',
				completedStep: 9,
				releaseBranch: 'release/0.0.4',
			}),
			'utf-8'
		);
		const loaded = loadState(tmpDir);
		assert.ok(loaded);
		assert.equal(loaded!.completedStep, 'github_release');
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
			JSON.stringify({
				completedStep: 'bump',
				releaseBranch: 'release/x',
			}),
			'utf-8'
		);
		assert.equal(loadState(tmpDir), null);
	});

	it('returns null when completedStep is unknown', () => {
		saveState(tmpDir, {
			version: '1.0.0',
			completedStep: 'nonexistent' as never,
			releaseBranch: 'release/1.0.0',
		});
		assert.equal(loadState(tmpDir), null);
	});
});

describe('isCompleted', () => {
	it('returns true when step is at or before completed step', () => {
		assert.equal(isCompleted('merge_main', 'bump'), true);
		assert.equal(isCompleted('merge_main', 'changelog'), true);
		assert.equal(isCompleted('merge_main', 'commit'), true);
		assert.equal(isCompleted('merge_main', 'merge_main'), true);
	});

	it('returns false when step is after completed step', () => {
		assert.equal(isCompleted('merge_main', 'github_release'), false);
		assert.equal(isCompleted('merge_main', 'npm_publish'), false);
		assert.equal(isCompleted('merge_main', 'unreleased'), false);
	});
});

describe('nextStep', () => {
	it('returns the next step', () => {
		assert.equal(nextStep('bump'), 'changelog');
		assert.equal(nextStep('merge_main'), 'github_release');
	});

	it('returns null for the last step', () => {
		assert.equal(nextStep('unreleased'), null);
	});
});

describe('STEP_ORDER', () => {
	it('has 9 steps in correct order', () => {
		assert.deepEqual(STEP_ORDER, [
			'bump',
			'changelog',
			'scaffold',
			'commit',
			'merge_main',
			'github_release',
			'npm_publish',
			'merge_development',
			'unreleased',
		]);
	});
});

describe('saveState', () => {
	it('writes a valid JSON file', () => {
		const state: PipelineState = {
			version: '1.0.0',
			completedStep: 'changelog',
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
			completedStep: 'github_release',
			releaseBranch: 'release/2.0.0',
		});
		assert.ok(loadState(tmpDir));
		clearState(tmpDir);
		assert.equal(loadState(tmpDir), null);
	});

	it('is a no-op when no state file exists', () => {
		clearState(tmpDir);
		assert.equal(loadState(tmpDir), null);
	});
});
