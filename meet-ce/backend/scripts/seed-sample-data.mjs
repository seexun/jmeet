/**
 * Sample data seed script for JMeet UI review.
 *
 * Usage (from meet-ce/backend):
 *   node scripts/seed-sample-data.mjs
 *
 * Environment:
 *   MONGO_URI      (default mongodb://localhost:27017)
 *   MONGO_DB_NAME  (default jmeet)
 *
 * Safety rules:
 *   - Every sample document carries a custom string _id prefixed with `sample_`
 *     (and/or `sample-` business keys). The script first deletes only documents
 *     matching those markers, then re-inserts. It is idempotent.
 *   - It NEVER deletes whole collections and NEVER mutates existing
 *     non-sample documents.
 *   - Sample users copy the passwordHash of the existing `admin` account so
 *     they can log in with admin/admin style credentials.
 *
 * NOTE on collection names: the running backend build resolves mongoose model
 * names to lowercased pluralized collections (`meetusers`, `meetrooms`, ...),
 * while some source schemas declare `collection: 'MeetUser'` explicitly. For
 * those entities this script seeds the collection that actually holds data
 * (preferring the lowercase name on ties) so the running UI picks it up.
 */

import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'jmeet';

const SAMPLE_ID_PREFIX = 'sample_';
const SAMPLE_ID_RE = /^sample_/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Collection name candidates [preferred(used by running build), source-schema name]. */
const CANDIDATES = {
	users: ['meetusers', 'MeetUser'],
	rooms: ['meetrooms', 'MeetRoom'],
	roomMembers: ['meetroommembers', 'MeetRoomMember'],
	globalConfig: ['meetglobalconfigs', 'MeetGlobalConfig']
};

const FIXED = {
	meetingSessions: 'meeting_sessions'
};

const now = Date.now();
const daysFromNow = (days, hourOfDay = 10, minute = 0) => {
	const d = new Date(now + days * DAY_MS);
	d.setHours(hourOfDay, minute, 0, 0);
	return d.getTime();
};
const isoDate = (days) => new Date(daysFromNow(days, 18)).toISOString().slice(0, 10);
const rand = (n) => Math.random().toString(36).slice(2, 2 + n);

async function resolveCollection(db, [preferred, fallback]) {
	const counts = await Promise.all(
		[preferred, fallback].map(async (name) => {
			try {
				return await db.collection(name).countDocuments({});
			} catch {
				return -1;
			}
		})
	);
	if (counts[1] > counts[0]) return fallback;
	return preferred;
}

async function cleanup(db, collectionName, extraFilter = {}) {
	const r = await db.collection(collectionName).deleteMany({ _id: SAMPLE_ID_RE, ...extraFilter });
	return r.deletedCount || 0;
}

async function insertManyLogged(db, collectionName, docs, label) {
	if (docs.length === 0) return 0;
	await db.collection(collectionName).insertMany(docs, { ordered: false });
	console.log(`  ${label}: inserted ${docs.length} into "${collectionName}"`);
	return docs.length;
}

async function main() {
	console.log(`Connecting to ${MONGO_URI} db=${MONGO_DB_NAME} ...`);
	await mongoose.connect(MONGO_URI, { dbName: MONGO_DB_NAME });
	const db = mongoose.connection.db;

	const users = await resolveCollection(db, CANDIDATES.users);
	const rooms = await resolveCollection(db, CANDIDATES.rooms);
	const roomMembers = await resolveCollection(db, CANDIDATES.roomMembers);
	const globalConfig = await resolveCollection(db, CANDIDATES.globalConfig);

	// ---- Reference documents (never modified, only read) --------------------
	const adminUser =
		(await db.collection(users).findOne({ loginName: 'admin' })) ||
		(await db.collection(users).findOne({ role: 'admin' })) ||
		(await db.collection(users).findOne({}));
	if (!adminUser) throw new Error('No existing user found to copy passwordHash from; seed aborted.');
	const adminId = adminUser.userId;
	const passwordHash = adminUser.passwordHash;
	const userSchemaVersion = adminUser.schemaVersion ?? 2;

	const refRoom = await db.collection(rooms).findOne({});
	const roomSchemaVersion = refRoom?.schemaVersion ?? 3;
	const configSchemaVersion =
		(await db.collection(globalConfig).findOne({}))?.schemaVersion ?? 6;

	console.log(`admin userId=${adminId}, users="${users}", rooms="${rooms}"`);

	// ---- Cleanup previous sample documents ---------------------------------
	console.log('Cleaning previous sample documents...');
	const cleaned = {};
	cleaned.users = await cleanup(db, users);
	cleaned.rooms = await cleanup(db, rooms);
	cleaned.roomMembers = await cleanup(db, roomMembers);
	cleaned.meetingSessions = await cleanup(db, FIXED.meetingSessions);
	const removedTotal = Object.values(cleaned).reduce((a, b) => a + b, 0);
	console.log(`  removed ${removedTotal} previous sample document(s)`);

	const summary = {};

	// ---- 1. Users (8) -------------------------------------------------------
	const sampleUsers = [
		{ id: 'sample-user-01', login: 'sample-wangjianguo', name: '王建国', role: 'admin', dept: '信息中心', days: -20, enabled: true },
		{ id: 'sample-user-02', login: 'sample-lixiaomei', name: '李晓梅', role: 'room_manager', dept: '产品部', days: -18, enabled: true },
		{ id: 'sample-user-03', login: 'sample-zhangwei', name: '张伟', role: 'room_manager', dept: '研发中心', days: -15, enabled: true },
		{ id: 'sample-user-04', login: 'sample-chenjing', name: '陈静', role: 'room_member', dept: '人力资源部', days: -12, enabled: true },
		{ id: 'sample-user-05', login: 'sample-liuyang', name: '刘洋', role: 'room_member', dept: '财务部', days: -9, enabled: true },
		{ id: 'sample-user-06', login: 'sample-zhaofang', name: '赵芳', role: 'room_member', dept: '客户成功部', days: -6, enabled: true },
		{ id: 'sample-user-07', login: 'sample-sunzhiqiang', name: '孙志强', role: 'room_member', dept: '运维组', days: -3, enabled: false },
		{ id: 'sample-user-08', login: 'sample-zhoumin', name: '周敏', role: 'room_member', dept: '市场部', days: -1, enabled: true }
	].map((u, i) => ({
		_id: `${SAMPLE_ID_PREFIX}user-${i + 1}`,
		schemaVersion: userSchemaVersion,
		userId: u.id,
		loginName: u.login,
		name: u.name,
		email: `${u.login}@example.com`,
		employeeNumber: `EMP-S${String(i + 1).padStart(3, '0')}`,
		registrationDate: daysFromNow(u.days, 9, 30),
		role: u.role,
		roleUpdatedAt: daysFromNow(u.days, 9, 30),
		passwordHash,
		mustChangePassword: false,
		enabled: u.enabled,
		authVersion: 1,
	}));
	summary.users = await insertManyLogged(db, users, sampleUsers, 'users');

	// ---- 2. Rooms (6) -------------------------------------------------------
	const moderatorPerms = {
		canRecord: true, canRetrieveRecordings: true, canDeleteRecordings: true, canJoinMeeting: true,
		canShareAccessLinks: true, canMakeModerator: true, canKickParticipants: true, canEndMeeting: true,
		canPublishVideo: true, canPublishAudio: true, canShareScreen: true, canReadChat: true,
		canWriteChat: true, canChangeVirtualBackground: true
	};
	const speakerPerms = {
		canRecord: false, canRetrieveRecordings: true, canDeleteRecordings: false, canJoinMeeting: true,
		canShareAccessLinks: false, canMakeModerator: false, canKickParticipants: false, canEndMeeting: false,
		canPublishVideo: true, canPublishAudio: true, canShareScreen: true, canReadChat: true,
		canWriteChat: true, canChangeVirtualBackground: true
	};
	const roomBaseConfig = {
		security: {
			securityLevel: 'standard', waitingRoomEnabled: false, locked: false,
			accessScope: 'anyone_with_link', allowJoinBeforeHost: true, muteOnEntry: true,
			allowSelfUnmute: true, screenSharePolicy: 'all_participants', allowParticipantRename: true,
			allowMultipleDevices: false, watermarkEnabled: false
		},
		chat: { enabled: true },
		recording: { enabled: true, layout: 'grid', encoding: 'H264_720P_30' },
		virtualBackground: { enabled: true },
		e2ee: { enabled: false },
		captions: { enabled: true }
	};
	const buildAccess = (roomId) => ({
		anonymous: {
			moderator: { enabled: true, url: `/room/${roomId}?secret=${Math.floor(1000000000 + Math.random() * 9000000000)}` },
			speaker: { enabled: true, url: `/room/${roomId}?secret=${Math.floor(1000000000 + Math.random() * 9000000000)}` }
		},
		user: { enabled: false, url: `/room/${roomId}` }
	});
	const roomDefs = [
		{ n: 1, name: '产品周会会议室', status: 'open', end: 'none', days: -20, schedule: { startDays: 1, duration: 60, recurrence: 'weekly' } },
		{ n: 2, name: '季度复盘会议室', status: 'active_meeting', end: 'none', days: -17, securityLevel: 'internal', waitingRoom: true },
		{ n: 3, name: '新人培训教室', status: 'open', end: 'none', days: -14, schedule: { startDays: 3, duration: 120, recurrence: 'none' } },
		{ n: 4, name: '研发站会室', status: 'open', end: 'close', days: -10, securityLevel: 'confidential' },
		{ n: 5, name: '客户演示厅', status: 'closed', end: 'none', days: -6, watermark: true },
		{ n: 6, name: '全员大会堂', status: 'open', end: 'delete', days: -2, autoDelete: true }
	];
	const sampleRooms = roomDefs.map((r) => {
		const roomId = `room-sample${String(r.n).padStart(2, '0')}`;
		const doc = {
			_id: `${SAMPLE_ID_PREFIX}room-${r.n}`,
			schemaVersion: roomSchemaVersion,
			roomId,
			roomName: r.name,
			owner: adminId,
			creationDate: daysFromNow(r.days, 14),
			config: {
				...roomBaseConfig,
				security: {
					...roomBaseConfig.security,
					securityLevel: r.securityLevel ?? 'standard',
					waitingRoomEnabled: Boolean(r.waitingRoom),
					watermarkEnabled: Boolean(r.watermark)
				}
			},
			roles: {
				moderator: { permissions: { ...moderatorPerms } },
				speaker: { permissions: { ...speakerPerms } }
			},
			access: buildAccess(roomId),
			status: r.status,
			rolesUpdatedAt: daysFromNow(r.days, 14),
			meetingEndAction: r.end
		};
		if (r.schedule) {
			doc.schedule = {
				startDate: daysFromNow(r.schedule.startDays, 10),
				durationMinutes: r.schedule.duration,
				timezone: 'Asia/Shanghai',
				recurrence: r.schedule.recurrence,
				allowEarlyJoinMinutes: 15
			};
		}
		if (r.autoDelete) {
			doc.autoDeletionPolicy = { withMeeting: 'fail', withRecordings: 'close' };
			doc.autoDeletionDate = daysFromNow(30, 23);
		}
		return doc;
	});
	summary.rooms = await insertManyLogged(db, rooms, sampleRooms, 'rooms');
	const roomId = (n) => `room-sample${String(n).padStart(2, '0')}`;
	const roomName = (n) => roomDefs.find((r) => r.n === n).name;

	// ---- 3. Meeting sessions (10) ------------------------------------------
	const sessionDefs = [
		{ n: 1, room: 1, status: 'completed', days: -19, lenH: 1 },
		{ n: 2, room: 2, status: 'completed', days: -16, lenH: 2.5 },
		{ n: 3, room: 3, status: 'completed', days: -12, lenH: 1.5 },
		{ n: 4, room: 4, status: 'completed', days: -9, lenH: 0.5 },
		{ n: 5, room: 1, status: 'completed', days: -5, lenH: 1 },
		{ n: 6, room: 2, status: 'completed', days: -2, lenH: 3 },
		{ n: 7, room: 4, status: 'active', startedMinAgo: 35 },
		{ n: 8, room: 6, status: 'active', startedMinAgo: 8 },
		{ n: 9, room: 3, status: 'starting', startedMinAgo: 1 },
		{ n: 10, room: 5, status: 'failed', startedMinAgo: 90, failMin: 5 }
	];
	const sampleSessions = sessionDefs.map((s) => {
		const startedAt = s.days !== undefined ? daysFromNow(s.days, 10, 30) : now - s.startedMinAgo * 60000;
		const endedAt =
			s.status === 'completed' ? startedAt + s.lenH * 3600000
			: s.status === 'failed' ? startedAt + s.failMin * 60000
			: s.status === 'cancelled' ? startedAt + 600000
			: undefined;
		return {
			_id: `${SAMPLE_ID_PREFIX}session-${s.n}`,
			meetingSessionId: `ms_SAMPLE${String(s.n).padStart(3, '0')}`,
			roomId: roomId(s.room),
			livekitRoomSid: `RM_SAMPLE${String(s.n).padStart(3, '0')}`,
			status: s.status,
			startedAt,
			endedAt,
			hostIdentity: adminId,
			participantIdentities: [adminId, 'sample-user-03', 'sample-user-04', 'sample-user-06'].slice(0, 2 + (s.n % 3)),
			createdAt: startedAt - 60000,
			updatedAt: endedAt ?? now,
			legalHold: s.n === 2,
			...(s.n === 2
				? { legalHoldReason: '涉密项目合规审查', legalHoldUpdatedBy: adminId, legalHoldUpdatedAt: endedAt ?? now }
				: {})
		};
	});
	summary.meetingSessions = await insertManyLogged(db, FIXED.meetingSessions, sampleSessions, 'meeting sessions');

	// ---- 10. Room members (8 across 2 rooms) --------------------------------
	const memberDefs = [
		{ n: 1, room: 1, userId: adminId, name: 'Admin', type: 'user', role: 'moderator' },
		{ n: 2, room: 1, userId: 'sample-user-02', name: '李晓梅', type: 'user', role: 'moderator' },
		{ n: 3, room: 1, userId: 'sample-user-03', name: '张伟', type: 'user', role: 'speaker' },
		{ n: 4, room: 1, userId: 'sample-user-04', name: '陈静', type: 'user', role: 'speaker' },
		{ n: 5, room: 2, userId: adminId, name: 'Admin', type: 'user', role: 'moderator' },
		{ n: 6, room: 2, userId: 'sample-user-05', name: '刘洋', type: 'user', role: 'speaker' },
		{ n: 7, room: 2, userId: 'sample-user-06', name: '赵芳', type: 'user', role: 'speaker' },
		{ n: 8, room: 2, userId: `guest-${rand(8)}`, name: '客户嘉宾', type: 'identified_guest', role: 'speaker' }
	];
	const sampleMembers = memberDefs.map((m) => ({
		_id: `${SAMPLE_ID_PREFIX}member-${m.n}`,
		schemaVersion: 1,
		memberId: `sample-member-${String(m.n).padStart(2, '0')}`,
		roomId: roomId(m.room),
		type: m.type,
		name: m.name,
		membershipDate: daysFromNow(-7 - (m.n % 10), 15),
		accessUrl: `/room/${roomId(m.room)}`,
		baseRole: m.role,
		effectivePermissions: m.role === 'moderator' ? { ...moderatorPerms } : { ...speakerPerms },
		permissionsUpdatedAt: daysFromNow(-7 - (m.n % 10), 15)
	}));
	summary.roomMembers = await insertManyLogged(db, roomMembers, sampleMembers, 'room members');

	// ---- Done ----------------------------------------------------------------
	console.log('\nSeed complete. Inserted counts:');
	for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${v}`);
	await mongoose.disconnect();
}

main().catch(async (err) => {
	console.error('Seed failed:', err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
