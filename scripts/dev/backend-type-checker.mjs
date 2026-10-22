import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendDir = resolve(__dirname, '../../meet-ce/backend');

let tscProcess = null;
let hasTypeErrors = false;

function startTypeChecker() {
	console.log('🔍 Starting type checker in watch mode...', backendDir);

	// Use tsconfig.prod.json: it carries the Express v5 type pin (`paths`) that the base tsconfig.json
	// intentionally omits so tsx can resolve `express` at runtime. See meet-ce/backend/tsconfig.prod.json.
	tscProcess = spawn('pnpm', ['tsc', '--noEmit', '--watch', '--preserveWatchOutput', '-p', 'tsconfig.prod.json'], {
		cwd: backendDir,
		stdio: 'pipe',
		shell: true
	});

	tscProcess.stdout.on('data', (data) => {
		const output = data.toString();
		const lines = output.split(/\r?\n/);

		lines.forEach((line) => {
			if (/error TS\d+/.test(line)) {
				console.error(`\x1b[31m${line}\x1b[0m`);
				console.error('\x1b[31m------------------------\x1b[0m');
				hasTypeErrors = true;
			} else if (/Found \d+ errors?/.test(line)) {
				const count = parseInt(line.match(/Found (\d+) errors?/)?.[1] || '0', 10);

				if (count > 0) {
					console.error(`\x1b[31m❌ Type errors detected (${count})\x1b[0m`);
				} else if (hasTypeErrors) {
					hasTypeErrors = false;
					console.log(`\x1b[32m✅ Type check passed — no type errors\x1b[0m`);
					console.log('\x1b[2mWatching for changes...\x1b[0m');
				}
			} else if (line.trim()) {
				console.log(line);
			}
		});
	});

	tscProcess.stderr.on('data', (data) => {
		process.stderr.write(data.toString());
	});

	tscProcess.on('close', (code) => {
		if (code !== 0) {
			console.error(`\x1b[31mType checker exited with code ${code}\x1b[0m`);
		}
	});
}

// Start type checker
startTypeChecker();

// Cleanup on exit
['SIGINT', 'SIGTERM'].forEach((signal) => {
	process.on(signal, () => {
		if (tscProcess) tscProcess.kill();

		process.exit(0);
	});
});
