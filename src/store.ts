import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import pc from 'picocolors';
import type { ReleaseConfig } from './types';

const STORE_DIRS = [
	'changelogs',
	'images/phoneScreenshots',
	'images/tabletScreenshots',
] as const;

const STORE_FILES = [
	'title.txt',
	'short_description.txt',
	'full_description.txt',
] as const;

/**
 * Creates the Fastlane-compatible metadata directory tree.
 * Only creates directories and placeholder files that don't already exist.
 * Existing files are never overwritten.
 */
export function scaffoldStoreMetadata(
	config: ReleaseConfig,
	cwd: string
): void {
	const storeConfig = config.storeMetadata;
	if (!storeConfig) return;

	const basePath = storeConfig.path!;
	const locales = storeConfig.locales ?? ['en-US'];

	let createdDirs = 0;
	let createdFiles = 0;

	for (const locale of locales) {
		const localePath = path.join(basePath, locale);

		// Create locale directory
		if (!existsSync(localePath)) {
			mkdirSync(localePath, { recursive: true });
			createdDirs++;
			console.log(
				pc.green(`Created: ${path.relative(cwd, localePath)}/`)
			);
		}

		// Create subdirectories
		for (const dir of STORE_DIRS) {
			const dirPath = path.join(localePath, dir);
			if (!existsSync(dirPath)) {
				mkdirSync(dirPath, { recursive: true });
				createdDirs++;
				console.log(
					pc.green(`Created: ${path.relative(cwd, dirPath)}/`)
				);
			}

			// Add .gitkeep to each empty subdirectory
			const gitkeepPath = path.join(dirPath, '.gitkeep');
			if (!existsSync(gitkeepPath)) {
				writeFileSync(gitkeepPath, '', 'utf-8');
				createdFiles++;
				console.log(
					pc.green(`Created: ${path.relative(cwd, gitkeepPath)}`)
				);
			}
		}

		// Create placeholder text files
		for (const file of STORE_FILES) {
			const filePath = path.join(localePath, file);
			if (!existsSync(filePath)) {
				writeFileSync(filePath, '', 'utf-8');
				createdFiles++;
				console.log(
					pc.green(`Created: ${path.relative(cwd, filePath)}`)
				);
			}
		}
	}

	if (createdDirs > 0 || createdFiles > 0) {
		console.log(
			pc.blue(
				`Store metadata scaffolded: ${createdDirs} dirs, ${createdFiles} files`
			)
		);
	} else {
		console.log(
			pc.blue('Store metadata directory already exists — skipping')
		);
	}
}
