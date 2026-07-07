import path from 'path';
import type { ReleaseConfig } from './types';

const DEFAULTS: Partial<ReleaseConfig> = {
	branches: {
		main: 'main',
		development: 'development',
		releasePrefix: 'release',
	},
	bumpFiles: [{ path: 'package.json', type: 'json', key: 'version' }],
	changelog: {
		path: 'CHANGELOG.md',
	},
	publish: {
		npm: false,
		github: true,
	},
	preflight: {
		typecheck: 'yarn typecheck',
		lint: 'yarn lint',
		test: 'yarn test',
	},
	storeMetadata: {
		path: 'fastlane/metadata/android',
		locales: ['en-US'],
	},
};

export function resolveConfig(
	cwd: string,
	userConfig: ReleaseConfig
): ReleaseConfig {
	const resolved: ReleaseConfig = {
		repo: userConfig.repo,
		branches: { ...DEFAULTS.branches, ...userConfig.branches },
		bumpFiles: userConfig.bumpFiles ?? DEFAULTS.bumpFiles,
		changelog: {
			...DEFAULTS.changelog,
			...userConfig.changelog,
		},
		publish: {
			...DEFAULTS.publish,
			...userConfig.publish,
		},
		preflight: {
			...DEFAULTS.preflight,
			...userConfig.preflight,
		},
		storeMetadata: {
			...DEFAULTS.storeMetadata,
			...userConfig.storeMetadata,
		},
	};

	if (userConfig.versionCode) {
		resolved.versionCode = userConfig.versionCode;
	}

	// Resolve relative paths to absolute
	if (resolved.changelog?.path) {
		resolved.changelog.path = path.resolve(cwd, resolved.changelog.path);
	}
	if (resolved.bumpFiles) {
		resolved.bumpFiles = resolved.bumpFiles.map((bf) => ({
			...bf,
			path: path.resolve(cwd, bf.path),
		}));
	}
	if (resolved.storeMetadata?.path) {
		resolved.storeMetadata = {
			...resolved.storeMetadata,
			path: path.resolve(cwd, resolved.storeMetadata.path),
		};
	}

	return resolved;
}
