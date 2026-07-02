import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import path from 'path';
import pc from 'picocolors';

export interface PipelineState {
	version: string;
	completedStep: number;
	releaseBranch: string;
	noPublish?: string[];
	noTest?: boolean;
	noLint?: boolean;
}

const STATE_FILE = '.release-kit-state.json';

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

		if (state.completedStep < 4 || state.completedStep > 11) {
			console.warn(
				pc.yellow(
					`Invalid ${STATE_FILE}: completedStep ${state.completedStep} out of range — ignoring`
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
