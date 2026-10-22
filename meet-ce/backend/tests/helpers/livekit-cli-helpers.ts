import { MeetRoomMemberTokenMetadata } from '@openvidu-meet/typings';
import { ChildProcess, spawn } from 'child_process';
import { MEET_ENV } from '../../src/environment.js';
import {
	waitForParticipantsToDisconnect,
	waitForParticipantToConnect,
	waitForParticipantToUpdateMetadata
} from './wait-helpers.js';

const fakeParticipantsProcesses = new Map<string, ChildProcess>();
/** Tracks all room IDs that currently have at least one fake participant joined via joinFakeParticipant. */
const fakeParticipantRooms = new Set<string>();

/**
 * Adds a fake participant to a LiveKit room for testing purposes.
 *
 * @param roomId The ID of the room to join
 * @param participantIdentity The identity for the fake participant
 */
export const joinFakeParticipant = async (roomId: string, participantIdentity: string) => {
	await ensureLivekitCliInstalled();
	const process = spawnLivekitCliProcess([
		'room',
		'join',
		'--identity',
		participantIdentity,
		'--publish-demo',
		roomId
	]);

	// Store the process to be able to terminate it later
	fakeParticipantsProcesses.set(`${roomId}-${participantIdentity}`, process);
	fakeParticipantRooms.add(roomId);
	await waitForParticipantToConnect(roomId, participantIdentity);
};

/**
 * Updates the metadata for a participant in a LiveKit room.
 *
 * @param roomId The ID of the room
 * @param participantIdentity The identity of the participant
 * @param metadata The metadata to update
 */
export const updateParticipantMetadata = async (
	roomId: string,
	participantIdentity: string,
	metadata: MeetRoomMemberTokenMetadata
) => {
	await ensureLivekitCliInstalled();
	spawnLivekitCliProcess([
		'room',
		'participants',
		'update',
		'--room',
		roomId,
		'--identity',
		participantIdentity,
		'--metadata',
		JSON.stringify(metadata)
	]);
	await waitForParticipantToUpdateMetadata(
		roomId,
		participantIdentity,
		metadata as unknown as Record<string, unknown>
	);
};

export const disconnectFakeParticipants = async () => {
	// Capture the rooms that had fake participants before clearing the set
	const roomIds = [...fakeParticipantRooms];
	await ensureLivekitCliInstalled();

	fakeParticipantsProcesses.forEach((process, participant) => {
		process.kill();
		console.log(`Stopped process for participant '${participant}'`);
	});

	fakeParticipantsProcesses.clear();

	for (const roomId of roomIds) {
		const identities = await listRoomParticipantIdentities(roomId);

		for (const identity of identities) {
			try {
				await executeLivekitCliCommand([
					'room',
					'participants',
					'remove',
					'--room',
					roomId,
					'--identity',
					identity
				]);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				console.warn(
					`Could not remove participant '${identity}' from room '${roomId}'. Continuing cleanup. Reason: ${errorMessage}`
				);
			}
		}
	}

	fakeParticipantRooms.clear();

	// Wait until LiveKit confirms no participants remain in any of the affected rooms
	await waitForParticipantsToDisconnect(roomIds);
};

const withLivekitCredentials = (args: string[]): string[] => {
	return [...args, '--api-key', MEET_ENV.LIVEKIT_API_KEY, '--api-secret', MEET_ENV.LIVEKIT_API_SECRET];
};

const spawnLivekitCliProcess = (args: string[], stdio: 'pipe' | 'inherit' = 'pipe'): ChildProcess => {
	return spawn('lk', withLivekitCredentials(args), { stdio });
};

const executeLivekitCliCommand = async (args: string[], timeoutMs = 10000): Promise<string> => {
	return new Promise((resolve, reject) => {
		const process = spawnLivekitCliProcess(args, 'pipe');

		let stdout = '';
		let stderr = '';
		let hasResolved = false;

		const resolveOnce = (success: boolean, payload?: string) => {
			if (hasResolved) return;

			hasResolved = true;

			if (success) {
				resolve(payload ?? '');
			} else {
				reject(new Error(payload ?? 'LiveKit CLI command failed'));
			}
		};

		process.stdout?.on('data', (chunk) => {
			stdout += chunk.toString();
		});

		process.stderr?.on('data', (chunk) => {
			stderr += chunk.toString();
		});

		process.on('error', (error) => {
			resolveOnce(false, `Failed to execute LiveKit CLI: ${error.message}`);
		});

		process.on('exit', (code) => {
			if (code === 0) {
				resolveOnce(true, stdout);
			} else {
				resolveOnce(
					false,
					`LiveKit CLI exited with code ${code}. stderr: ${stderr.trim() || 'N/A'}. stdout: ${stdout.trim() || 'N/A'}`
				);
			}
		});

		setTimeout(() => {
			process.kill();
			resolveOnce(false, `LiveKit CLI command timed out after ${timeoutMs}ms`);
		}, timeoutMs);
	});
};

const parseParticipantIdentities = (participantsListOutput: string): string[] => {
	const headerTokens = new Set(['identity', 'id', 'name']);

	const identities = participantsListOutput
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.filter((line) => !/^[-=+|]+$/.test(line))
		.map((line) => line.split(/\s+/)[0])
		.map((token) => token.replace(/^\|+|\|+$/g, ''))
		.filter((token) => token.length > 0)
		.filter((token) => !headerTokens.has(token.toLowerCase()));

	return [...new Set(identities)];
};

const listRoomParticipantIdentities = async (roomId: string): Promise<string[]> => {
	const output = await executeLivekitCliCommand(['room', 'participants', 'list', roomId]);

	return parseParticipantIdentities(output);
};

const ensureLivekitCliInstalled = async (): Promise<void> => {
	return new Promise((resolve, reject) => {
		const checkProcess = spawn('lk', ['--version'], {
			stdio: 'pipe'
		});

		let hasResolved = false;

		const resolveOnce = (success: boolean, message?: string) => {
			if (hasResolved) return;

			hasResolved = true;

			if (success) {
				resolve();
			} else {
				reject(new Error(message || 'LiveKit CLI check failed'));
			}
		};

		checkProcess.on('error', (error) => {
			if (error.message.includes('ENOENT')) {
				resolveOnce(false, '❌ LiveKit CLI tool "lk" is not installed or not in PATH.');
			} else {
				resolveOnce(false, `Failed to check LiveKit CLI: ${error.message}`);
			}
		});

		checkProcess.on('exit', (code) => {
			if (code === 0) {
				resolveOnce(true);
			} else {
				resolveOnce(false, `LiveKit CLI exited with code ${code}`);
			}
		});

		setTimeout(() => {
			checkProcess.kill();
			resolveOnce(false, 'LiveKit CLI check timed out');
		}, 5000);
	});
};
