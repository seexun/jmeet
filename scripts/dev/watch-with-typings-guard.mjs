#!/usr/bin/env node
import { spawn } from 'child_process';
import { watch } from 'fs';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import treeKill from 'tree-kill';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CE_TYPINGS_FLAG_PATH = resolve(__dirname, '../../meet-ce/typings/dist/typings-ready.flag');
const CE_TYPINGS_DIST = resolve(__dirname, '../../meet-ce/typings/dist');
const DEBOUNCE_MS = 500; // Wait 500ms after flag appears before restarting
const KILL_TIMEOUT_MS = 5000; // Max time to wait for process to die
const POLL_DIR_MS = 1000; // Polling interval for directories that don't yet exist

// Get command from arguments
const command = process.argv.slice(2).join(' ');

if (!command) {
	console.error('❌ Error: No command provided');
	console.error('Usage: watch-with-typings-guard.mjs <command>');
	process.exit(1);
}

let childProcess = null;
// We'll support multiple targets (CE and PRO). Each target has its own ready state.
const targets = [];
let pendingRestart = null;
let hasStartedOnce = false;
let isKilling = false;

/**
 * Start the child process
 */
async function startProcess() {
	// Process should start only when all required targets report ready
	const allReady = targets.length > 0 && targets.every((t) => t.isReady);
	if (!allReady) {
		if (!hasStartedOnce) {
			const names = targets.map((t) => t.name).join(', ');
			console.log(`Waiting for typings to be ready for: ${names}...`);
		}
		return;
	}

	if (childProcess) {
		console.log('Restarting process...');
		await killProcess();
	}

	if (isKilling) {
		console.log('Waiting for previous process to terminate...');
		return;
	}

	console.log(`Starting: ${command}`);
	childProcess = spawn(command, {
		shell: true,
		stdio: 'inherit',
		env: { ...process.env },
		detached: false
	});

	hasStartedOnce = true;

	childProcess.on('exit', (code) => {
		if (code !== null && code !== 0 && !isKilling) {
			console.error(`❌ Process exited with code ${code}`);
		}
		childProcess = null;
		isKilling = false;
	});
}

/**
 * Kill the child process gracefully (and wait for it to die)
 */
function killProcess() {
	return new Promise((resolve) => {
		if (!childProcess || isKilling) {
			resolve();
			return;
		}

		isKilling = true;
		const pid = childProcess.pid;

		// Set a timeout in case the process doesn't die
		const timeout = setTimeout(() => {
			console.error(`⚠️  Process ${pid} didn't terminate gracefully, force killing...`);
			if (childProcess) {
				try {
					treeKill(pid, 'SIGKILL');
				} catch (err) {
					console.error('Error force killing process:', err.message);
				}
			}
			isKilling = false;
			childProcess = null;
			resolve();
		}, KILL_TIMEOUT_MS);

		// Try graceful shutdown first
		childProcess.once('exit', () => {
			clearTimeout(timeout);
			isKilling = false;
			childProcess = null;
			resolve();
		});

		try {
			// Kill the entire process tree (important for shells that spawn subprocesses)
			treeKill(pid, 'SIGTERM', (err) => {
				if (err) {
					console.error(`⚠️  Error killing process tree: ${err.message}`);
					// Fallback to direct kill
					try {
						childProcess?.kill('SIGTERM');
					} catch (e) {
						console.error('Error in fallback kill:', e.message);
					}
				}
			});
		} catch (err) {
			console.error('Error killing process:', err.message);
			clearTimeout(timeout);
			isKilling = false;
			childProcess = null;
			resolve();
		}
	});
}

/**
 * Schedule a restart with debouncing
 */
function scheduleRestart() {
	// Don't schedule if we're currently killing a process
	if (isKilling) {
		console.log('Process is being killed, will restart when done...');
		// Will retry after kill completes
		setTimeout(scheduleRestart, 100);
		return;
	}

	if (pendingRestart) {
		clearTimeout(pendingRestart);
	}

	pendingRestart = setTimeout(async () => {
		pendingRestart = null;
		await startProcess();
	}, DEBOUNCE_MS);
}

/**
 * Check if typings are ready
 */
function checkTypingsReady() {
	let changed = false;
	for (const t of targets) {
		const wasReady = t.isReady;
		t.isReady = existsSync(t.flagPath);
		if (!wasReady && t.isReady) {
			console.log(`✅ Typings ready for ${t.name}!`);
			changed = true;
		} else if (wasReady && !t.isReady) {
			console.log(`Typings recompiling for ${t.name}... (process will restart when ready)`);
			changed = true;
		}
	}

	if (changed) {
		scheduleRestart();
	}

	return targets.every((t) => t.isReady);
}

/**
 * Watch the flag file
 */
/**
 * Create a watcher for a single target that watches its flag dir and dist dir.
 * If the directories don't exist yet, we poll until they appear then create watchers.
 */
function watchTarget(target) {
	console.log(`Setting up watchers for ${target.name}`);

	// Initial check
	checkTypingsReady();

	const flagDir = dirname(target.flagPath);
	const distDir = target.distPath;

	function createWatchers() {
		try {
			if (!target.flagWatcher && existsSync(flagDir)) {
				target.flagWatcher = watch(flagDir, { recursive: false }, (eventType, filename) => {
					if (filename === 'typings-ready.flag') {
						checkTypingsReady();
					}
				});

				target.flagWatcher.on('error', (error) => {
					console.error(`❌ Watcher error for ${target.name} flag:`, error);
				});
			}

			if (!target.distWatcher && existsSync(distDir)) {
				target.distWatcher = watch(distDir, { recursive: true }, (eventType, filename) => {
					if (filename === 'typings-ready.flag') return;
					if (childProcess && target.isReady) {
						console.log(`Detected change in ${target.name} typings: ${filename} (will restart when compilation finishes)`);
					}
				});

				target.distWatcher.on('error', (error) => {
					console.error(`❌ Watcher error for ${target.name} dist:`, error);
				});
			}

			// If we have at least one watcher, stop polling
			if ((target.flagWatcher || target.distWatcher) && target.poller) {
				clearInterval(target.poller);
				target.poller = null;
			}
		} catch (err) {
			// Rare race - ignore and keep polling
			// console.error(`Error creating watcher for ${target.name}:`, err.message);
		}
	}

	// If directories are already present, create watchers immediately
	if (existsSync(flagDir) || existsSync(distDir)) {
		createWatchers();
	}

	// Start polling for directory creation if watchers not yet created
	if (!target.flagWatcher && !target.distWatcher) {
		target.poller = setInterval(() => {
			createWatchers();
		}, POLL_DIR_MS);
	}

	return () => {
		if (target.flagWatcher) {
			try { target.flagWatcher.close(); } catch (e) {}
			target.flagWatcher = null;
		}
		if (target.distWatcher) {
			try { target.distWatcher.close(); } catch (e) {}
			target.distWatcher = null;
		}
		if (target.poller) {
			clearInterval(target.poller);
			target.poller = null;
		}
	};
}

/**
 * Watch typings/dist for changes (to trigger restart when ready)
 */
function setupTargetsFromCommand() {
	targets.push({
		name: 'CE',
		flagPath: CE_TYPINGS_FLAG_PATH,
		distPath: CE_TYPINGS_DIST,
		isReady: false,
		flagWatcher: null,
		distWatcher: null,
		poller: null,
	});
}

// Setup targets based on command
setupTargetsFromCommand();

// Create watchers for each target and keep cleanup functions
const cleanupFns = [];
for (const t of targets) {
	const cleanup = watchTarget(t);
	cleanupFns.push(cleanup);
}

// Kick an initial check/start attempt (in case flags already ready)
checkTypingsReady();

// Cleanup on exit
async function doCleanupAndExit(code = 0) {
	console.log('\n🛑 Stopping...');
	await killProcess();
	for (const fn of cleanupFns) {
		try { fn(); } catch (e) {}
	}
	process.exit(code);
}

process.on('SIGINT', async () => {
	await doCleanupAndExit(0);
});

process.on('SIGTERM', async () => {
	await doCleanupAndExit(0);
});
