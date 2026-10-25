import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import pc from 'picocolors';
import semver from 'semver';
import type { SimpleGit } from 'simple-git';
import type { ReleaseConfig } from './types';
import { getCurrentVersionFromFile } from './version';
import { fatalError } from './errors';

export { fatalError };

export async function validateVersionIsHigher(
	newVersion: string,
	versionFilePath: string,
	git: SimpleGit
): Promise<string> {
	await git.fetch(['--tags']);
	const currentVersion = getCurrentVersionFromFile(versionFilePath);

	if (semver.lte(newVersion, currentVersion)) {
		fatalError(
			`New version (${newVersion}) must be higher than current version (${currentVersion})`
		);
	}

	return currentVersion;
}

/**
 * Rejects version jumps that skip steps: the next version must be a single
 * patch/minor/major increment from the current one (e.g. 0.4.0 → 0.4.1 /
 * 0.5.0 / 1.0.0), a pre-release of such an increment (0.4.0 →
 * 0.5.0-beta.1), or a pre-release step within the same core version
 * (0.5.0-beta.1 → 0.5.0-beta.2 → 0.5.0-rc.1 → 0.5.0).
 */
export function validateNoSkippedVersions(
	currentVersion: string,
	newVersion: string
): void {
	const current = semver.parse(currentVersion);
	const next = semver.parse(newVersion);
	if (!current || !next) {
		fatalError(
			`Could not parse versions: ${currentVersion} → ${newVersion}`
		);
	}

	const sameCore =
		next.major === current.major &&
		next.minor === current.minor &&
		next.patch === current.patch;
	if (sameCore) {
		if (current.prerelease.length === 0) {
			fatalError(
				`New version (${newVersion}) reuses the released core version ${currentVersion} — versions must increase step by step.`
			);
		}
		// Pre-release step within the same core (beta.1 → beta.2 → rc.1 →
		// stable). The higher/equal check already rejects regressions.
		return;
	}

	const patchBump =
		next.major === current.major &&
		next.minor === current.minor &&
		next.patch === current.patch + 1;
	const minorBump =
		next.major === current.major &&
		next.minor === current.minor + 1 &&
		next.patch === 0;
	const majorBump =
		next.major === current.major + 1 &&
		next.minor === 0 &&
		next.patch === 0;

	if (!patchBump && !minorBump && !majorBump) {
		fatalError(
			`New version (${newVersion}) skips versions — versions must increase step by step from ${currentVersion}. ` +
				`Allowed next versions: ${current.major}.${current.minor}.${current.patch + 1}, ` +
				`${current.major}.${current.minor + 1}.0, ${current.major + 1}.0.0, ` +
				`or pre-releases of these.`
		);
	}
}

export async function checkCleanWorkingTree(git: SimpleGit): Promise<void> {
	const status = await git.status();
	if (!status.isClean()) {
		const dirtyFiles = status.files
			.map((f) => `  ${f.index} ${f.path}`)
			.join('\n');
		fatalError('Unable to publish. Uncommitted changes.\n' + dirtyFiles);
	}
}

export function checkGitHubToken(): void {
	if (!process.env.GITHUB_TOKEN) {
		fatalError(
			'GITHUB_TOKEN environment variable is required to create a GitHub release. ' +
				'Run `export GITHUB_TOKEN=$(gh auth token)` or generate one at ' +
				'https://github.com/settings/tokens (scope: repo).'
		);
	}
}

export function checkNpmAuth(): void {
	try {
		const whoami = execSync('npm whoami', { encoding: 'utf-8' }).trim();
		if (!whoami) {
			fatalError(
				'npm authentication required. Run `npm login` or `npm adduser` first.'
			);
		}
		console.log(pc.green(`npm authenticated as ${whoami}`));
	} catch {
		fatalError(
			'npm authentication required. Run `npm login` or `npm adduser` first.'
		);
	}
}

export function checkChangelogHasUnreleased(changelogPath: string): void {
	const content = readFileSync(changelogPath, 'utf-8');
	if (!/## \[?Unreleased\]?/i.test(content)) {
		fatalError(
			'CHANGELOG.md should have an `[Unreleased]` or `Unreleased` section'
		);
	}
}

const KNOWN_CHANGELOG_SECTIONS = [
	'Added',
	'Changed',
	'Deprecated',
	'Removed',
	'Fixed',
	'Security',
] as const;

/**
 * Validates that every `### <Section>` heading inside the `[Unreleased]` block
 * is a standard Keep a Changelog section. A non-standard heading (e.g.
 * `### Dependencies`) would otherwise crash the keep-a-changelog serializer
 * later (a cryptic "reading '0'" TypeError) — fail fast here with a clear
 * message instead.
 */
export function checkChangelogSections(changelogPath: string): void {
	const content = readFileSync(changelogPath, 'utf-8');

	const unreleasedIdx = content.search(/## \[?Unreleased\]?/i);
	if (unreleasedIdx === -1) {
		// No [Unreleased] section — handled by checkChangelogHasUnreleased.
		return;
	}

	const after = content.slice(unreleasedIdx);
	const nextVersionIdx = after.search(/\n## \[[0-9]/);
	const body = nextVersionIdx === -1 ? after : after.slice(0, nextVersionIdx);

	const unknown: string[] = [];
	for (const match of body.matchAll(/^### (.+)$/gm)) {
		const heading = (match[1] ?? '').trim();
		if (
			!(KNOWN_CHANGELOG_SECTIONS as readonly string[]).includes(heading)
		) {
			unknown.push(heading);
		}
	}

	if (unknown.length > 0) {
		fatalError(
			'CHANGELOG.md [Unreleased] has unknown section(s): ' +
				unknown.map((h) => `"${h}"`).join(', ') +
				'. Allowed: ' +
				KNOWN_CHANGELOG_SECTIONS.join(', ') +
				'.'
		);
	}
}

export async function checkBranchIsRelease(
	git: SimpleGit,
	releasePrefix: string
): Promise<void> {
	const branch = (await git.branch()).current;
	if (!branch.startsWith(releasePrefix)) {
		fatalError(
			`Current branch name should start with \`${releasePrefix}\``
		);
	}
}

export function runCommand(label: string, command: string, cwd: string): void {
	console.log(pc.blue(`${label}…`));
	try {
		execSync(command, { stdio: 'inherit', cwd });
	} catch {
		fatalError(`Unable to publish. ${label} failed. Fix errors first!`);
	}
}

export function runPreflights(
	config: ReleaseConfig,
	root: string,
	opts: { test: boolean; lint: boolean }
): void {
	// Always run typecheck, unless explicitly disabled
	if (config.preflight?.typecheck === false) {
		console.log(pc.yellow('Skipping typecheck (disabled)'));
	} else {
		runCommand(
			'Typecheck',
			config.preflight?.typecheck || 'yarn typecheck',
			root
		);
	}

	if (config.preflight?.lint !== false && opts.lint) {
		runCommand('Lint', config.preflight?.lint || 'yarn lint', root);
	} else if (!opts.lint) {
		console.log(pc.yellow('Skipping lint (--no-lint)'));
	}

	if (config.preflight?.test !== false && opts.test) {
		runCommand('Tests', config.preflight?.test || 'yarn test', root);
	} else if (!opts.test) {
		console.log(pc.yellow('Skipping tests (--no-test)'));
	}
}
