import { readdir, stat, readFile } from 'fs/promises';
import path from 'path';
import pc from 'picocolors';
import { Octokit } from '@octokit/rest';
import { fatalError } from './checks';
import { extractReleaseBody } from './changelog';

interface GitHubPublishOptions {
	attachment?: boolean;
}

interface RepoInfo {
	owner: string;
	repo: string;
}

// Platform-agnostic candidate directories for build artifacts.
// Extend this map to add support for additional platforms.
const CANDIDATE_DIRS = [
	{ dir: 'android/app/build/outputs/apk', exts: ['.apk'] },
	{ dir: 'android/app/build/outputs/bundle', exts: ['.aab'] },
	{ dir: 'ios/build', exts: ['.ipa'] },
];

function getContentType(fileName: string): string {
	if (fileName.endsWith('.apk'))
		return 'application/vnd.android.package-archive';
	if (fileName.endsWith('.ipa')) return 'application/octet-stream';
	return 'application/octet-stream';
}

function formatOctokitError(err: unknown): string {
	if (err && typeof err === 'object') {
		const e = err as Record<string, unknown>;
		const status = e.status ? ` ${e.status}` : '';
		const message = e.message ? ` — ${e.message}` : '';
		return `${status}${message}`.trim() || String(err);
	}
	return String(err);
}

function parseRepoUrl(repoUrl: string): RepoInfo {
	// https://github.com/owner/repo
	const httpsMatch = repoUrl.match(
		/https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?\s*$/
	);
	if (httpsMatch) {
		return {
			owner: httpsMatch[1]!,
			repo: httpsMatch[2]!.replace(/\.git$/, '').replace(/\/$/, ''),
		};
	}

	// Fallback: treat as owner/repo
	const slashMatch = repoUrl.match(/^([^/]+)\/(.+)$/);
	if (slashMatch) {
		return { owner: slashMatch[1]!, repo: slashMatch[2]! };
	}

	fatalError(
		'Could not parse GitHub owner/repo from: ' +
			repoUrl +
			'. ' +
			'Use a full https:// URL or owner/repo format.'
	);
}

async function findReleaseByTag(
	octokit: Octokit,
	owner: string,
	repo: string,
	tag: string
): Promise<{ id: number } | null> {
	try {
		const { data } = await octokit.rest.repos.getReleaseByTag({
			owner,
			repo,
			tag,
		});
		return { id: data.id };
	} catch (err: unknown) {
		if (
			err &&
			typeof err === 'object' &&
			'status' in err &&
			(err as { status: number }).status === 404
		) {
			return null;
		}
		throw err;
	}
}

/**
 * Recursively walks a directory yielding every file matching the given
 * extensions (case-insensitive match).
 */
async function* walkDir(
	dirPath: string,
	exts: readonly string[]
): AsyncGenerator<string> {
	let entries;
	try {
		entries = await readdir(dirPath, { withFileTypes: true });
	} catch (err: unknown) {
		const code =
			err && typeof err === 'object' && 'code' in err
				? (err as { code: string }).code
				: '';
		const message =
			err && typeof err === 'object' && 'message' in err
				? (err as { message: string }).message
				: String(err);
		console.warn(
			pc.yellow(
				`Cannot read directory ${dirPath}: ${code ? `${code} — ` : ''}${message}`
			)
		);
		return;
	}

	for (const entry of entries) {
		const entryPath = path.join(dirPath, entry.name);
		if (entry.isDirectory()) {
			yield* walkDir(entryPath, exts);
		} else if (exts.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
			yield entryPath;
		}
	}
}

export async function findAttachments(cwd: string): Promise<string[]> {
	const found: string[] = [];

	for (const { dir, exts } of CANDIDATE_DIRS) {
		const fullDir = path.join(cwd, dir);
		try {
			const dirStat = await stat(fullDir);
			if (!dirStat.isDirectory()) continue;
		} catch (err: unknown) {
			const code =
				err && typeof err === 'object' && 'code' in err
					? (err as { code: string }).code
					: '';
			// ENOENT = doesn't exist — silently skip (no build outputs yet).
			// Other errors (EACCES, etc.) warrant a warning.
			if (code !== 'ENOENT') {
				const message =
					err && typeof err === 'object' && 'message' in err
						? (err as { message: string }).message
						: String(err);
				console.warn(
					pc.yellow(
						`Cannot access ${fullDir}: ${code ? `${code} — ` : ''}${message}`
					)
				);
			}
			continue;
		}

		for await (const filePath of walkDir(fullDir, exts)) {
			found.push(filePath);
		}
	}

	return found;
}

export async function createGitHubRelease(
	version: string,
	repoUrl: string,
	changelogPath: string,
	options?: GitHubPublishOptions
): Promise<void> {
	const token = process.env.GITHUB_TOKEN;
	if (!token) {
		fatalError(
			'GITHUB_TOKEN environment variable is required to create a GitHub release. ' +
				'Run `export GITHUB_TOKEN=$(gh auth token)` or generate one at ' +
				'https://github.com/settings/tokens (scope: repo).'
		);
	}

	const cwd = process.cwd();
	const octokit = new Octokit({ auth: token });
	const { owner, repo } = parseRepoUrl(repoUrl);
	const tagName = 'v' + version;
	const body = extractReleaseBody(version, changelogPath);

	const existingRelease = await findReleaseByTag(
		octokit,
		owner,
		repo,
		tagName
	);

	let releaseId: number;

	if (existingRelease) {
		await octokit.rest.repos.updateRelease({
			owner,
			repo,
			release_id: existingRelease.id,
			tag_name: tagName,
			name: tagName,
			body,
			draft: false,
		});
		releaseId = existingRelease.id;
		console.log(pc.green('Updated GitHub release: ' + tagName));
	} else {
		const { data } = await octokit.rest.repos.createRelease({
			owner,
			repo,
			tag_name: tagName,
			name: tagName,
			body,
			draft: false,
		});
		releaseId = data.id;
		console.log(pc.green('Created GitHub release: ' + tagName));
	}

	// Upload attachments if enabled
	if (options?.attachment) {
		const attachments = await findAttachments(cwd);

		if (attachments.length === 0) {
			console.log(
				pc.yellow(
					'No build artifacts found in standard output directories. ' +
						'Build the project first or check the paths.'
				)
			);
		} else {
			// Use Promise.allSettled for parallel uploads with per-file error handling
			const results = await Promise.allSettled(
				attachments.map(async (filePath) => {
					// Use a relative path from cwd as the asset name to avoid
					// collisions between files in different subdirectories
					// that share the same basename.
					const relativePath = path.relative(cwd, filePath);
					const assetName = relativePath.replace(/[/\\]/g, '-');

					console.log(pc.blue(`Uploading attachment: ${assetName}…`));

					const fileBuffer = await readFile(filePath);

					await octokit.rest.repos.uploadReleaseAsset({
						owner,
						repo,
						release_id: releaseId,
						name: assetName,
						data: fileBuffer as unknown as string,
						headers: {
							'content-length': String(fileBuffer.length),
							'content-type': getContentType(filePath),
						},
					});

					console.log(pc.green(`Uploaded: ${assetName}`));
				})
			);

			const failed = results.filter(
				(r): r is PromiseRejectedResult => r.status === 'rejected'
			);
			const succeeded = results.length - failed.length;

			if (succeeded > 0) {
				console.log(
					pc.green(
						`${succeeded} attachment${succeeded !== 1 ? 's' : ''} uploaded`
					)
				);
			}

			if (failed.length > 0) {
				// Check if any failures are auth-related (401/403) — those
				// suggest a systemic issue; surface them prominently.
				for (const f of failed) {
					console.error(
						pc.red(
							`Failed to upload attachment: ${formatOctokitError(f.reason)}`
						)
					);
				}

				// If ALL uploads failed, treat it as best-effort — log
				// but don't abort the pipeline (release itself succeeded).
				if (failed.length === results.length) {
					console.warn(
						pc.yellow(
							'All attachment uploads failed. The GitHub release was created without attachments.'
						)
					);
				}
			}
		}
	}
}
