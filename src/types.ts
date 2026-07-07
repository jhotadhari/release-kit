export interface BumpFile {
	path: string;
	type: 'json' | 'gradle';
	key?: string;
}

export interface StoreMetadataConfig {
	path?: string;
	locales?: string[];
}

export interface VersionCodeConfig {
	multiplier: {
		major: number;
		minor: number;
		patch: number;
	};
	preReleaseOffsets?: Record<string, number>;
}

export interface ReleaseConfig {
	repo: string;
	branches?: {
		main?: string;
		development?: string;
		releasePrefix?: string;
	};
	bumpFiles?: BumpFile[];
	changelog?: {
		path?: string;
	};
	publish?: {
		npm?: boolean | { buildCommand?: string | false };
		github?: boolean | { attachment?: boolean };
	};
	versionCode?: VersionCodeConfig;
	storeMetadata?: StoreMetadataConfig;
	preflight?: {
		typecheck?: string | false;
		lint?: string | false;
		test?: string | false;
	};
}

export function defineConfig(config: ReleaseConfig): ReleaseConfig {
	return config;
}
