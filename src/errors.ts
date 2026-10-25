import pc from 'picocolors';

export function fatalError(message: string): never {
	console.error(pc.red('ERROR'), message);
	process.exit(1);
}
