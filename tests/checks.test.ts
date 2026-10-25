import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkChangelogHasUnreleased, checkChangelogSections, validateNoSkippedVersions } from '../src/checks';

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

describe('checkChangelogSections', () => {
	before(() => {
		tmpDir = join(tmpdir(), `release-kit-section-test-${Date.now()}`);
		mkdirSync(tmpDir);
		process.exit = mockExit as typeof process.exit;
	});

	after(() => {
		rmSync(tmpDir, { recursive: true, force: true });
		process.exit = originalExit;
	});

	it('passes for standard sections', () => {
		const path = createFile(
			'CHANGELOG.md',
			'# Changelog\n\n## [Unreleased]\n### Added\n- A\n### Changed\n- B\n### Removed\n- C\n\n## [1.0.0] - 2020-01-01\n### Added\n- old\n',
		);
		checkChangelogSections(path);
	});

	it('passes for an empty [Unreleased] section', () => {
		const path = createFile(
			'CHANGELOG.md',
			'# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2020-01-01\n',
		);
		checkChangelogSections(path);
	});

	it('throws for an unknown section', () => {
		const path = createFile(
			'CHANGELOG.md',
			'# Changelog\n\n## [Unreleased]\n### Dependencies\n- foo\n',
		);
		assert.throws(
			() => {
				checkChangelogSections(path);
			},
			{ message: /process.exit/ },
		);
	});

	it('ignores unknown sections outside [Unreleased]', () => {
		const path = createFile(
			'CHANGELOG.md',
			'# Changelog\n\n## [Unreleased]\n### Added\n- A\n\n## [1.0.0] - 2020-01-01\n### Dependencies\n- old\n',
		);
		checkChangelogSections(path);
	});
});

describe('validateNoSkippedVersions', () => {
	before(() => {
		process.exit = mockExit as typeof process.exit;
	});

	after(() => {
		process.exit = originalExit;
	});

	it('allows a patch bump', () => {
		validateNoSkippedVersions('0.4.0', '0.4.1');
	});

	it('allows a minor bump', () => {
		validateNoSkippedVersions('0.4.0', '0.5.0');
	});

	it('allows a major bump', () => {
		validateNoSkippedVersions('0.4.0', '1.0.0');
	});

	it('allows a pre-release of a minor bump', () => {
		validateNoSkippedVersions('0.4.0', '0.5.0-beta.1');
	});

	it('allows a pre-release of a major bump', () => {
		validateNoSkippedVersions('0.4.0', '1.0.0-alpha.1');
	});

	it('allows pre-release steps within the same core version', () => {
		validateNoSkippedVersions('0.5.0-beta.1', '0.5.0-beta.2');
		validateNoSkippedVersions('0.5.0-beta.2', '0.5.0-rc.1');
	});

	it('allows promoting a pre-release to stable', () => {
		validateNoSkippedVersions('0.5.0-rc.1', '0.5.0');
	});

	it('allows a patch bump from a pre-release core', () => {
		validateNoSkippedVersions('0.5.0-beta.1', '0.5.1');
	});

	it('rejects a multi-major jump (0.4.0 → 5.0.0-beta.1)', () => {
		assert.throws(
			() => {
				validateNoSkippedVersions('0.4.0', '5.0.0-beta.1');
			},
			{ message: /process.exit/ },
		);
	});

	it('rejects a skipped patch (0.4.0 → 0.4.2)', () => {
		assert.throws(
			() => {
				validateNoSkippedVersions('0.4.0', '0.4.2');
			},
			{ message: /process.exit/ },
		);
	});

	it('rejects a skipped minor (0.4.0 → 0.6.0)', () => {
		assert.throws(
			() => {
				validateNoSkippedVersions('0.4.0', '0.6.0');
			},
			{ message: /process.exit/ },
		);
	});

	it('rejects a multi-major jump (1.0.0 → 3.0.0)', () => {
		assert.throws(
			() => {
				validateNoSkippedVersions('1.0.0', '3.0.0');
			},
			{ message: /process.exit/ },
		);
	});

	it('rejects reusing a released stable core', () => {
		assert.throws(
			() => {
				validateNoSkippedVersions('0.5.0', '0.5.0');
			},
			{ message: /process.exit/ },
		);
	});
});
