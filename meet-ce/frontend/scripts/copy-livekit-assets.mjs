// Vendors the runtime assets LiveKit needs into src/assets, so the Angular
// application builder (which only accepts asset inputs inside the project root)
// serves them and the app loads them from the Meet server instead of a CDN:
//   1) livekit-client's E2EE Web Worker                      -> src/assets/livekit/
//   2) @mediapipe/tasks-vision WASM (used by                 -> src/assets/mediapipe/wasm/
//      @livekit/track-processors for the virtual background)
// Both are version-coupled to their packages, so they are copied from node_modules
// on every build/serve/install (gitignored) instead of being committed. Resolving
// via require.resolve keeps it robust to pnpm hoisting and the track-processors
// fork (link: override). The selfie-segmenter .tflite model is NOT here: it ships
// with no npm package, so it stays committed under src/assets/mediapipe/.
import { createRequire } from 'node:module';
import { cpSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const assetsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets');

// 1) livekit-client E2EE worker -> assets/livekit/
const WORKER_FILE = 'livekit-client.e2ee.worker.mjs';
const workerSrc = join(dirname(require.resolve('livekit-client')), WORKER_FILE);
const livekitDir = join(assetsDir, 'livekit');
mkdirSync(livekitDir, { recursive: true });
copyFileSync(workerSrc, join(livekitDir, WORKER_FILE));

// 2) @mediapipe/tasks-vision WASM -> assets/mediapipe/wasm/
// Resolve tasks-vision as @livekit/track-processors sees it, so the vendored wasm
// matches the version its FilesetResolver expects (handles the fork override too).
const trackProcessorsRequire = createRequire(require.resolve('@livekit/track-processors'));
const mediapipeWasmSrc = join(dirname(trackProcessorsRequire.resolve('@mediapipe/tasks-vision')), 'wasm');
cpSync(mediapipeWasmSrc, join(assetsDir, 'mediapipe', 'wasm'), { recursive: true });

console.log('[livekit] Vendored E2EE worker + MediaPipe WASM into src/assets/');
