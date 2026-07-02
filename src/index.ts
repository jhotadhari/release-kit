import pc from 'picocolors';
import type { ParsedArgs } from './cli';
import { parseArgs } from './cli';
import { resolveConfig } from './config';
import {
	validateVersionIsHigher,
	checkCleanWorkingTree,
	checkChangelogHasUnreleased,
	checkBranchIsRelease,
	checkGitHubToken,
	checkNpmAuth,
	runPreflights,
} from './checks';
import { getCurrentVersion, bumpAllFiles } from './version';
import { releaseChangelog, addUnreleasedSection } from './changelog';
import {
	createGit,
	getCurrentBranch,
	gitStageAllAndCommit,
	gitMergeToMain,
	gitTagAndPush,
	gitMergeToDevelopment,
	gitStageChangelogAndCommit,
	gitPush,
} from './git';
import { createGitHubRelease } from './github';
import { runBuild, npmPublish } from './npm';
import {
	loadState,
	saveState,
	clearState,
	isCompleted,
	type StepKey,
} from './state';
import type { ReleaseConfig } from './types';

export const release = async (userConfig: ReleaseConfig): Promise<void> => {
	const cwd = process.cwd();
	const config = resolveConfig(cwd, userConfig);

	// 1. Parse version and flags from CLI args
	const args: ParsedArgs = parseArgs();
	const { version, dryRun, noPublish } = args;

	if (dryRun) {
		console.log(pc.yellow('--dry-run: no mutations will be made'));
	}
	if (noPublish.length > 0) {
		console.log(
			pc.yellow(`--no-publish: skipping ${noPublish.join(', ')}`)
		);
	}
	console.log(
		pc.blue(`Publishing v${version}${dryRun ? ' (dry-run)' : ''}…`)
	);

	const git = createGit(cwd);
	const pkgPath =
		config.bumpFiles?.find((bf) => bf.path.endsWith('package.json'))
			?.path ?? config.bumpFiles![0]!.path;
	const changelogPath = config.changelog!.path!;

	// Check for resume state before pre-flight (some checks depend on it)
	const releaseBranch = await getCurrentBranch(git);
	const existingState = loadState(cwd);

	if (existingState) {
		if (existingState.version !== version) {
			console.warn(
				pc.yellow(
					`State file version (${existingState.version}) does not match ${version} — starting fresh.`
				)
			);
			clearState(cwd);
		} else if (existingState.releaseBranch !== releaseBranch) {
			console.warn(
				pc.yellow(
					`State file branch (${existingState.releaseBranch}) does not match ${releaseBranch} — starting fresh.`
				)
			);
			clearState(cwd);
		} else {
			console.log(
				pc.blue(
					`Resuming from step "${existingState.completedStep}"`
				)
			);
		}
	}

	const state = loadState(cwd);
	const completedStep = state?.completedStep ?? null;
	const stateBranch = state?.releaseBranch ?? releaseBranch;

	const done = (step: StepKey) =>
		completedStep ? isCompleted(completedStep, step) : false;

	// 2. Pre-flight validations (some skipped on resume)
	if (!done('bump')) {
		await validateVersionIsHigher(version, pkgPath, git);
	} else {
		console.log(pc.yellow('Skipping version check (already bumped)'));
	}
	await checkCleanWorkingTree(git);
	if (config.changelog && !done('changelog')) {
		checkChangelogHasUnreleased(changelogPath);
	} else if (config.changelog) {
		console.log(
			pc.yellow('Skipping [Unreleased] check (already released)')
		);
	}
	await checkBranchIsRelease(git, config.branches!.releasePrefix!);
	if (
		config.publish?.github !== false &&
		!noPublish.includes('github') &&
		!done('github_release')
	) {
		checkGitHubToken();
	}
	if (
		config.publish?.npm &&
		!noPublish.includes('npm') &&
		!done('npm_publish')
	) {
		checkNpmAuth();
	}
	// Re-apply saved flags on resume
	const preflightTest = state?.noTest ? false : args.test;
	const preflightLint = state?.noLint ? false : args.lint;
	runPreflights(config, cwd, { test: preflightTest, lint: preflightLint });

	// 3. Dry-run: stop here, before any mutations
	if (dryRun) {
		console.log(
			pc.green(
				'All pre-flight checks passed. Ready to publish v' +
					version +
					'.'
			)
		);
		console.log(pc.yellow('Run again without --dry-run to publish.'));
		return;
	}

	const save = (step: StepKey) =>
		saveState(cwd, {
			version,
			completedStep: step,
			releaseBranch: stateBranch,
			noPublish: noPublish.length > 0 ? noPublish : undefined,
			noTest: args.test ? undefined : true,
			noLint: args.lint ? undefined : true,
		});

	// 4. Bump version in all configured files
	if (!done('bump')) {
		const currentVersion = getCurrentVersion(pkgPath);
		bumpAllFiles(config, currentVersion, version);
		save('bump');
	}

	// 5. Release changelog
	if (!done('changelog')) {
		if (config.changelog !== undefined) {
			releaseChangelog(version, changelogPath, config.repo);
		}
		save('changelog');
	}

	// 6. Stage & commit on release branch
	if (!done('commit')) {
		await gitStageAllAndCommit(git, `chore: release v${version}`);
		save('commit');
	}

	// 7. Merge to main, tag, push
	if (!done('merge_main')) {
		await gitMergeToMain(git, stateBranch, config.branches!.main!);
		await gitTagAndPush(git, version);
		save('merge_main');
	}

	// 8. GitHub release
	if (!done('github_release')) {
		if (
			config.publish?.github !== false &&
			!noPublish.includes('github')
		) {
			await createGitHubRelease(version, config.repo, changelogPath);
		} else {
			console.log(pc.yellow('Skipping GitHub release'));
		}
		save('github_release');
	}

	// 9. Build and npm publish
	if (!done('npm_publish')) {
		const npmConfig = config.publish?.npm;
		if (npmConfig && !noPublish.includes('npm')) {
			const buildCommand =
				typeof npmConfig === 'object'
					? (npmConfig.buildCommand ?? false)
					: false;
			if (buildCommand) {
				runBuild(buildCommand, cwd);
			}
			npmPublish(version, false, cwd);
		} else if (noPublish.includes('npm')) {
			console.log(pc.yellow('Skipping npm publish'));
		}
		save('npm_publish');
	}

	// 10. Merge to development
	if (!done('merge_development')) {
		await gitMergeToDevelopment(
			git,
			stateBranch,
			config.branches!.development!
		);
		save('merge_development');
	}

	// 11. Re-add [Unreleased] section, commit, push
	if (!done('unreleased')) {
		if (config.changelog !== undefined) {
			addUnreleasedSection(changelogPath, config.repo);
			await gitStageChangelogAndCommit(
				git,
				changelogPath,
				'chore: add [Unreleased] section to CHANGELOG.md'
			);
			await gitPush(git);
		}
		save('unreleased');
	}

	clearState(cwd);
	console.log(pc.green(`Done — v${version} published successfully.`));
};

// Re-export for consumers
export { defineConfig } from './types';
export type { ReleaseConfig, BumpFile, VersionCodeConfig } from './types';
