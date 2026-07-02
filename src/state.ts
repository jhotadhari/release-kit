import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import path from 'path';
import pc from 'picocolors';

/** Ordered list of pipeline steps. Order matters — resume compares by index. */
export const STEP_ORDER = [
	'bump',
	'changelog',
	'commit',
	'merge_main',
	'github_release',
	'npm_publish',
	'merge_development',
	'unreleased',
] as const;

export type StepKey = (typeof STEP_ORDER)[number];

export interface PipelineState {
	version: string;
	completedStep: StepKey;
	releaseBranch: string;
	noPublish?: string[];
	noTest?: boolean;
	noLint?: boolean;
}

const STATE_FILE = '.release-kit-state.json';

/** Returns true if `step` has already been completed (index <= completedStep index). */
export function isCompleted(
	completedStep: StepKey,
	step: StepKey
): boolean {
	return (
		STEP_ORDER.indexOf(completedStep) >= STEP_ORDER.indexOf(step)
	);
}

/** Returns the step immediately after the given step, or null if it was the last. */
export function nextStep(step: StepKey): StepKey | null {
	const idx = STEP_ORDER.indexOf(step);
	if (idx < 0 || idx >= STEP_ORDER.length - 1) return null;
	return STEP_ORDER[idx + 1]!;
}

export function loadState(cwd: string): PipelineState | null {
	const statePath = path.join(cwd, STATE_FILE);
	if (!existsSync(statePath)) return null;

	try {
		const raw = readFileSync(statePath, 'utf-8');
		const state = JSON.parse(raw) as PipelineState;

		// Basic validation
		if (!state.version || !state.completedStep || !state.releaseBranch) {
			console.warn(
				pc.yellow(
					`Invalid ${STATE_FILE} found — ignoring (missing required fields)`
				)
			);
			return null;
		}

		// Migrate legacy numeric step (0.0.4 format) to string key
		if (typeof state.completedStep === 'number') {
			const LEGACY_MAP: Record<number, StepKey> = {
				4: 'bump',
				5: 'changelog',
				6: 'commit',
				7: 'merge_main',
				8: 'github_release',
				9: 'npm_publish',
				10: 'merge_development',
				11: 'unreleased',
			};
			const migrated = LEGACY_MAP[state.completedStep];
			if (migrated) {
				state.completedStep = migrated;
			}
		}

		if (!STEP_ORDER.includes(state.completedStep)) {
			console.warn(
				pc.yellow(
					`Invalid ${STATE_FILE}: unknown step "${state.completedStep}" — ignoring`
				)
			);
			return null;
		}

		return state;
	} catch {
		console.warn(
			pc.yellow(`Could not parse ${STATE_FILE} — ignoring`)
		);
		return null;
	}
}

export function saveState(cwd: string, state: PipelineState): void {
	const statePath = path.join(cwd, STATE_FILE);
	writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

export function clearState(cwd: string): void {
	const statePath = path.join(cwd, STATE_FILE);
	if (existsSync(statePath)) {
		unlinkSync(statePath);
	}
}
