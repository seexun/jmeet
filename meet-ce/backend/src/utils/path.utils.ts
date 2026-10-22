import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Determines if the current environment is development or production.
 * It checks the NODE_ENV environment variable to determine the environment.
 * @returns
 */
const isDevEnvironment = (): boolean => {
	const isDev = process.env.NODE_ENV === 'development';

	// Log only in development to avoid noisy production logs
	if (isDev) {
		console.log('[PATH-UTILS] Environment:', 'development');
	}

	return isDev;
};

/**
 * Gets the root directory where the backend lives (one level above /src).
 */
// Helper: walk up the directory tree looking for a predicate
const findUp = (startDir: string, predicate: (d: string) => boolean): string | null => {
	let dir = path.resolve(startDir);
	let parent = path.dirname(dir);

	while (dir !== parent) {
		try {
			if (predicate(dir)) {
				return dir;
			}
		} catch (err) {
			// ignore fs errors and continue climbing
		}

		dir = parent;
		parent = path.dirname(dir);
	}

	return null;
};

const getBackendRoot = (): string => {
	// Try to detect backend root from current working directory first.
	const cwd = process.cwd();

	// If cwd is 'src', return its parent
	if (path.basename(cwd) === 'src') {
		return path.resolve(cwd, '..');
	}

	// If cwd contains a 'src' folder, treat cwd as backend root
	if (fs.existsSync(path.join(cwd, 'src'))) {
		return cwd;
	}

	// Otherwise, try to find upward a directory containing package.json and src
	const pkgRoot = findUp(
		cwd,
		(d) => fs.existsSync(path.join(d, 'package.json')) && fs.existsSync(path.join(d, 'src'))
	);

	if (pkgRoot) return pkgRoot;

	// Try using the file's directory as a fallback starting point
	const fileDir = path.dirname(fileURLToPath(import.meta.url));
	const pkgRootFromFile = findUp(
		fileDir,
		(d) => fs.existsSync(path.join(d, 'package.json')) && fs.existsSync(path.join(d, 'src'))
	);

	if (pkgRootFromFile) return pkgRootFromFile;

	// Last resort: assume two levels up from this file (previous behaviour)
	return path.resolve(fileDir, '../..');
};

/**
 * Resolves the project root dynamically based on current environment.
 * It assumes the backend directory exists in the current project (CE or PRO).
 */
const getProjectRoot = (): string => {
	// Prefer an explicit 'public' folder as sign of project root
	const cwd = process.cwd();
	const fileDir = path.dirname(fileURLToPath(import.meta.url));

	const publicFromCwd = findUp(cwd, (d) => fs.existsSync(path.join(d, 'public')));

	if (publicFromCwd) {
		if (isDevEnvironment()) console.log('[PATH-UTILS] Project root (public) found from CWD:', publicFromCwd);

		return publicFromCwd;
	}

	const publicFromFile = findUp(fileDir, (d) => fs.existsSync(path.join(d, 'public')));

	if (publicFromFile) {
		if (isDevEnvironment()) console.log('[PATH-UTILS] Project root (public) found from file dir:', publicFromFile);

		return publicFromFile;
	}

	// If no public folder found, fallback to backend root heuristics
	const backendRoot = getBackendRoot();

	if (isDevEnvironment()) console.log('[PATH-UTILS] Falling back to backend root as project root:', backendRoot);

	return backendRoot;
};

/**
 * Verifies if a given path exists and logs the result.
 * @param pathToVerify
 * @param description
 */
const verifyPathExists = (pathToVerify: string, description: string): void => {
	const exists = fs.existsSync(pathToVerify);

	if (isDevEnvironment()) {
		console.log(`[PATH-UTILS] ${description}: ${pathToVerify} (${exists ? 'EXISTS' : 'MISSING'})`);
	}

	if (!exists) {
		console.warn(`[PATH-UTILS] WARNING: ${description} not found at ${pathToVerify}`);
	}
};

// Initialize the path utilities (only verbose logs in development)
const isDev = isDevEnvironment();

if (isDev) {
	console.log('---------------------------------------------------------');
	console.log('[PATH-UTILS] Initializing path utilities...');
}

// Determine project root
const projectRoot = getProjectRoot();

// Export the paths for public files
export const publicDirectoryPath = path.join(projectRoot, 'public');
export const frontendDirectoryPath = path.join(publicDirectoryPath, 'frontend');
const openApiDirectoryPath = path.join(publicDirectoryPath, 'openapi');

export const frontendHtmlPath = path.join(frontendDirectoryPath, 'index.html');
export const internalApiHtmlFilePath = path.join(openApiDirectoryPath, 'internal.html');

// Verify the existence of the paths
if (isDev) {
	console.log('[PATH-UTILS] Project root resolved to:', projectRoot);
}

verifyPathExists(publicDirectoryPath, 'Public files directory');
verifyPathExists(frontendHtmlPath, 'Index HTML file');
verifyPathExists(internalApiHtmlFilePath, 'Internal API documentation');

if (isDev) {
	console.log('---------------------------------------------------------');
	console.log('');
}
