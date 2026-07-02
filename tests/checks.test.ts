import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkChangelogHasUnreleased } from '../src/checks';

let tmpDir: string;
const originalExit = process.exit;

// Suppress console output from fatalError during tests
const originalError = console.error;
console.error = () => {};
process.on('exit', () => {
	console.error = originalError;
});

function createFile(name: string, content: string): string {
	const path = join(tmpDir, name);
	writeFileSync(path, content, 'utf-8');
	return path;
}

function mockExit(exitCode?: number): never {
	throw new Error(`process.exit(${exitCode})`);
}

describe('checkChangelogHasUnreleased', () => {
	before(() => {
		tmpDir = join(tmpdir(), `release-kit-check-test-${Date.now()}`);
		mkdirSync(tmpDir);
		process.exit = mockExit as typeof process.exit;
	});

	after(() => {
		rmSync(tmpDir, { recursive: true, force: true });
		process.exit = originalExit;
	});

	it('passes when [Unreleased] section is present', () => {
		const path = createFile(
			'CHANGELOG.md',
			'# Changelog\n\n## [Unreleased]\n### Added\n- Stuff\n',
		);

		// Should not throw
		checkChangelogHasUnreleased(path);
	});

	it('passes when Unreleased without brackets is present', () => {
		const path = createFile(
			'CHANGELOG.md',
			'# Changelog\n\n## Unreleased\n### Added\n- Stuff\n',
		);

		// Should not throw — regex matches both [Unreleased] and Unreleased
		checkChangelogHasUnreleased(path);
	});

	it('passes when Unreleased uses different casing', () => {
		const path = createFile(
			'CHANGELOG.md',
			'# Changelog\n\n## [UNRELEASED]\n### Added\n- Stuff\n',
		);

		// Should not throw — regex is case-insensitive
		checkChangelogHasUnreleased(path);
	});

	it('throws when Unreleased section is missing', () => {
		const path = createFile(
			'CHANGELOG.md',
			'# Changelog\n\n## [1.0.0]\n### Added\n- Stuff\n',
		);

		assert.throws(
			() => {
				checkChangelogHasUnreleased(path);
			},
			{ message: /process.exit/ },
		);
	});
});
