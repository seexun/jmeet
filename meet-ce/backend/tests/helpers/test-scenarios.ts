import { expect } from '@jest/globals';
import {
	MeetRoomConfig,
	MeetRoomMember,
	MeetRoomMemberOptions,
	MeetRoomMemberPermissions,
	MeetRoomMemberRole,
	MeetUser,
	MeetUserOptions,
	MeetUserRole
} from '@openvidu-meet/typings';
import express, { Request, Response } from 'express';
import http from 'http';
import { StringValue } from 'ms';
import { container } from '../../src/config/dependency-injector.config';
import { MeetRoomHelper } from '../../src/helpers/room.helper';
import { RecordingRepository } from '../../src/repositories/recording.repository';
import { RoomRepository } from '../../src/repositories/room.repository';
import { LiveKitService } from '../../src/services/livekit.service.js';
import { RoomData, RoomMemberData, RoomTestUsers, TestContext, TestUsers, UserData } from '../interfaces/scenarios';
import { expectValidStartRecordingResponse } from './assertion-helpers';
import { joinFakeParticipant } from './livekit-cli-helpers.js';
import {
	changePassword,
	createRoom,
	createRoomMember,
	createUser,
	generateRoomMemberToken,
	loginUser,
	sleep,
	startRecording,
	stopRecording,
	updateRoomMember
} from './request-helpers';
import { waitForMeetingToEnd } from './wait-helpers.js';

let mockWebhookServer: http.Server;

/**
 * Creates a single room with optional participant.
 *
 * @param withParticipant Whether to join a fake participant in the room.
 * @param roomName        Name of the room to create.
 * @param config     Optional room config.
 * @returns               Room data including secrets and tokens.
 */
export const setupSingleRoom = async (
	withParticipant = false,
	roomName = 'TEST_ROOM',
	config?: Partial<MeetRoomConfig>
): Promise<RoomData> => {
	const room = await createRoom(
		{
			roomName,
			config
		},
		undefined,
		// Request the 'roles' extra field so consumers can read room.roles (excluded from responses by default)
		{ xExtraFields: 'roles' }
	);

	// Extract the room secrets and generate room member tokens
	const { moderatorSecret, speakerSecret, recordingSecret } = MeetRoomHelper.extractSecretsFromRoom(room.access);
	const [moderatorToken, speakerToken] = await Promise.all([
		generateRoomMemberToken(room.roomId, { secret: moderatorSecret, joinMeeting: false }),
		generateRoomMemberToken(room.roomId, { secret: speakerSecret, joinMeeting: false })
	]);

	// Join participant if needed
	if (withParticipant) {
		await joinFakeParticipant(room.roomId, 'TEST_PARTICIPANT');
	}

	return {
		room,
		moderatorSecret,
		moderatorToken,
		speakerSecret,
		speakerToken,
		recordingSecret
	};
};

/**
 * Creates a test context with multiple rooms and optional participants.
 *
 * @param numRooms         Number of rooms to create.
 * @param withParticipants Whether to join fake participants in the rooms.
 * @returns                Test context with created rooms and their data.
 */
export const setupMultiRoomTestContext = async (
	numRooms: number,
	withParticipants: boolean,
	roomConfig?: Partial<MeetRoomConfig>
): Promise<TestContext> => {
	const rooms: RoomData[] = [];

	for (let i = 0; i < numRooms; i++) {
		const roomData = await setupSingleRoom(withParticipants, 'TEST_ROOM', roomConfig);
		rooms.push(roomData);
	}

	return {
		rooms,
		getRoomByIndex: (index: number) => {
			if (index < 0 || index >= rooms.length) {
				return undefined;
			}

			return rooms[index];
		},

		getLastRoom: () => {
			if (rooms.length === 0) {
				return undefined;
			}

			return rooms[rooms.length - 1];
		}
	};
};

export const setupSingleRoomWithRecording = async (
	stopRecordingCond = false,
	stopDelay?: StringValue,
	roomName = 'TEST_ROOM'
): Promise<RoomData> => {
	const roomData = await setupSingleRoom(true, roomName);
	const response = await startRecording(roomData.room.roomId);
	expectValidStartRecordingResponse(response, roomData.room.roomId, roomData.room.roomName);
	roomData.recordingId = response.body.recordingId;

	// Wait for the configured delay before stopping the recording
	if (stopRecordingCond && stopDelay) {
		await sleep(stopDelay);
	}

	if (stopRecordingCond) {
		await stopRecording(roomData.recordingId!);
	}

	return roomData;
};

/**
 * Creates a completed recording in an existing room.
 * Starts a recording, optionally waits for a delay, then stops it.
 *
 * Note: The room must already exist and have an active meeting with participants.
 *
 * @param roomData  The room data where the recording will be created
 * @param stopDelay Optional delay before stopping the recording
 * @returns         The recording ID of the completed recording
 */
export const setupCompletedRecording = async (roomData: RoomData, stopDelay?: StringValue): Promise<string> => {
	// Start recording
	const response = await startRecording(roomData.room.roomId);
	expectValidStartRecordingResponse(response, roomData.room.roomId, roomData.room.roomName);
	const recordingId = response.body.recordingId;
	roomData.recordingId = recordingId;

	// Wait for the configured delay before stopping the recording
	if (stopDelay) {
		await sleep(stopDelay);
	}

	// Stop recording
	await stopRecording(recordingId);

	return recordingId;
};

/**
 * Creates a recording for a room and ensures it is stopped, returning the recording ID.
 *
 * @param roomId The ID of the room where the recording will be created
 * @returns      The recording ID of the created recording
 */
export const createRecordingForRoom = async (roomId: string): Promise<string> => {
	// Join a participant to ensure the meeting is active
	await joinFakeParticipant(roomId, `usr-${Date.now()}`);

	// Start recording
	const startResponse = await startRecording(roomId);
	expect(startResponse.status).toBe(201);
	const recordingId = startResponse.body.recordingId as string;

	// Stop recording
	await stopRecording(recordingId);

	// End the meeting
	const livekitService = container.get(LiveKitService);
	await livekitService.deleteRoom(roomId);
	await waitForMeetingToEnd(roomId);

	return recordingId;
};

/**
 * Quickly creates multiple recordings
 * Allows customizing how many recordings to start and how many to stop after a delay.
 *
 * @param numRooms  Number of rooms to use.
 * @param numStarts Number of recordings to start.
 * @param numStops  Number of recordings to stop after the delay.
 * @param stopDelay Delay before stopping recordings.
 * @returns         Test context with created recordings (some stopped, some still running).
 */
export const setupMultiRecordingsTestContext = async (
	numRooms: number,
	numStarts: number,
	numStops: number,
	stopDelay?: StringValue
): Promise<TestContext> => {
	// Setup rooms with participants
	const testContext = await setupMultiRoomTestContext(numRooms, true);

	// Start the specified number of recordings in parallel
	const startPromises = Array.from({ length: numStarts }).map(async (_, i) => {
		const roomIndex = i % numRooms;
		const roomData = testContext.getRoomByIndex(roomIndex);

		if (!roomData) {
			throw new Error(`Room at index ${roomIndex} not found`);
		}

		// Send start recording request
		const response = await startRecording(roomData.room.roomId);
		expectValidStartRecordingResponse(response, roomData.room.roomId, roomData.room.roomName);

		// Store the recordingId in context
		roomData.recordingId = response.body.recordingId;
		return roomData;
	});
	const startedRooms = await Promise.all(startPromises);

	// Wait for the configured delay before stopping recordings
	if (stopDelay) {
		await sleep(stopDelay);
	}

	// Stop recordings for the first numStops rooms
	const stopPromises = startedRooms.slice(0, numStops).map(async (roomData) => {
		if (roomData.recordingId) {
			await stopRecording(roomData.recordingId);
			console.log(`Recording stopped for room ${roomData.room.roomId}`);
			return roomData.recordingId;
		}

		return null;
	});
	const stoppedIds = (await Promise.all(stopPromises)).filter((id): id is string => Boolean(id));
	console.log(`Stopped ${stoppedIds.length} recordings after ${stopDelay}ms:`, stoppedIds);

	return testContext;
};

export const startWebhookServer = async (
	port: number,
	webhookReceivedCallback: (event: Request) => void
): Promise<void> => {
	const app = express();
	app.use(express.json());

	app.post('/webhook', (req: Request, res: Response) => {
		webhookReceivedCallback(req);
		res.status(200).send({ success: true });
	});

	return new Promise<void>((resolve) => {
		mockWebhookServer = app.listen(port, () => {
			console.log(`Webhook server listening on port ${port}`);
			resolve();
		});
	});
};

export const stopWebhookServer = async (): Promise<void> => {
	if (mockWebhookServer) {
		await new Promise<void>((resolve) => {
			mockWebhookServer.close(() => resolve());
		});
	}
};

/**
 * Creates a user with the specified role and returns UserData.
 *
 * @param userOptions Options for creating the user
 * @returns UserData with user info and access token
 */
export const setupUser = async (userOptions: MeetUserOptions): Promise<UserData> => {
	// Create the user
	const createResponse = await createUser(userOptions);
	expect(createResponse.status).toBe(201);
	const user = createResponse.body as MeetUser;

	// Login to get temporal access token for changing password
	const { accessToken: accessTokenTmp } = await loginUser(userOptions.userId, userOptions.password);

	// Change password and get final access token
	const newPassword = userOptions.password + '_2';
	const { accessToken, refreshToken } = await changePassword(userOptions.password, newPassword, accessTokenTmp);

	return {
		user,
		password: newPassword,
		accessToken: accessToken!,
		refreshToken: refreshToken!
	};
};

/**
 * Creates a collection of basic test users with different roles.
 *
 * @returns TestUsers with created users
 */
export const setupTestUsers = async (): Promise<TestUsers> => {
	const timestamp = String(Date.now()).slice(-6); // Use last 6 digits to keep userId under 20 chars

	const [admin, roomManager, roomMember] = await Promise.all([
		// Create admin user
		setupUser({
			userId: `adm_${timestamp}`,
			name: 'Admin',
			password: 'admin_pass',
			role: MeetUserRole.ADMIN
		}),
		// Create room manager user
		setupUser({
			userId: `usr_${timestamp}`,
			name: 'Room Manager',
			password: 'room_manager_pass',
			role: MeetUserRole.ROOM_MANAGER
		}),
		// Create room member user
		setupUser({
			userId: `rmb_${timestamp}`,
			name: 'Room Member',
			password: 'room_member_pass',
			role: MeetUserRole.ROOM_MEMBER
		})
	]);

	return {
		admin,
		roomManager,
		roomMember
	};
};

/**
 * Creates a room member for a specific room and returns RoomMemberData.
 *
 * @param roomId The ID of the room
 * @param memberOptions Options for creating the room member
 * @returns RoomMemberData with member info and authentication token
 */
export const setupRoomMember = async (
	roomId: string,
	memberOptions: MeetRoomMemberOptions,
	accessToken?: string
): Promise<RoomMemberData> => {
	// Create the room member
	const createResponse = await createRoomMember(roomId, memberOptions);
	expect(createResponse.status).toBe(201);
	const member = createResponse.body as MeetRoomMember;

	// Generate room member token for this member
	const secret = member.memberId.startsWith('guest-') ? member.memberId : undefined;
	const memberToken = await generateRoomMemberToken(
		roomId,
		{
			secret,
			joinMeeting: false
		},
		accessToken
	);

	return {
		member,
		memberToken
	};
};

export const updateRoomMemberPermissions = async (
	roomId: string,
	memberId: string,
	permissions: Partial<MeetRoomMemberPermissions>,
	accessToken?: string
): Promise<RoomMemberData> => {
	// Update the room member
	const updateResponse = await updateRoomMember(roomId, memberId, { customPermissions: permissions });
	expect(updateResponse.status).toBe(200);
	const member = updateResponse.body as MeetRoomMember;

	// Generate room member token for this member
	const secret = member.memberId.startsWith('guest-') ? member.memberId : undefined;
	const memberToken = await generateRoomMemberToken(
		roomId,
		{
			secret,
			joinMeeting: false
		},
		accessToken
	);

	return {
		member,
		memberToken
	};
};

/**
 * Sets up test users for a room, including owner, member, and room member.
 *
 * @param roomData The room data to set up users for
 * @returns Updated RoomData with test users included
 */
export const setupTestUsersForRoom = async (roomData: RoomData): Promise<RoomData> => {
	const timestamp = String(Date.now()).slice(-6); // Use last 6 digits to keep userId under 20 chars

	const [roomManagerOwner, roomManagerMember, roomMember] = await Promise.all([
		// Create user who is the owner of the room
		setupUser({
			userId: `usr_own_${timestamp}`,
			name: 'User Owner',
			password: 'owner_pass',
			role: MeetUserRole.ROOM_MANAGER
		}),
		// Create user who is a member of the room
		setupUser({
			userId: `usr_mem_${timestamp}`,
			name: 'User Member',
			password: 'member_pass',
			role: MeetUserRole.ROOM_MANAGER
		}),
		// Create room member user who is a member of the room
		setupUser({
			userId: `rmb_${timestamp}`,
			name: 'Room Member',
			password: 'room_member_pass',
			role: MeetUserRole.ROOM_MEMBER
		})
	]);

	// Change room ownership to roomManagerOwner
	const roomRepository = container.get(RoomRepository);
	const recordingRepository = container.get(RecordingRepository);
	const updatedRoom = await roomRepository.updatePartial(roomData.room.roomId, { owner: roomManagerOwner.user.userId });
	await recordingRepository.updateAccessScopeMetadataByRoomId(roomData.room.roomId, {
		roomOwner: roomManagerOwner.user.userId
	});
	roomData.room = updatedRoom;

	// Add roomManagerMember and roomMember as room members
	const [roomManagerMemberDetails, roomMemberDetails] = await Promise.all([
		setupRoomMember(
			roomData.room.roomId,
			{
				userId: roomManagerMember.user.userId,
				baseRole: MeetRoomMemberRole.MODERATOR
			},
			roomManagerMember.accessToken
		),
		setupRoomMember(
			roomData.room.roomId,
			{
				userId: roomMember.user.userId,
				baseRole: MeetRoomMemberRole.SPEAKER
			},
			roomMember.accessToken
		)
	]);
	const testUsers: RoomTestUsers = {
		roomManagerOwner,
		roomManagerMember,
		roomManagerMemberDetails,
		roomMember,
		roomMemberDetails
	};
	roomData.users = testUsers;
	return roomData;
};
