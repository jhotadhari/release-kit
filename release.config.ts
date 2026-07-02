import { defineConfig } from './src/index.ts';

export default defineConfig({
	repo: 'https://github.com/jhotadhari/release-kit',
	bumpFiles: [
		{ path: 'package.json', type: 'json', key: 'version' },
	],
	changelog: {
		path: 'CHANGELOG.md',
	},
	publish: {
		npm: { buildCommand: 'true' },
		github: true,
	},
});
