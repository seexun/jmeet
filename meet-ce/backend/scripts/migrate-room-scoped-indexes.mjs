/**
 * Room-scoped collaboration index migration for JMeet (agendas + materials).
 *
 * Purpose:
 *   The agenda/material collections moved from per-meeting-session uniqueness
 *   (`meetingSessionId+order`, `meetingSessionId+fileName+version`) to
 *   room-scoped uniqueness (`roomId+order`, `roomId+fileName+version`).
 *   Old databases still carry the obsolete unique indexes and possibly
 *   order/version sequences that were numbered per session, which would make
 *   creation of the new unique indexes fail. This script:
 *     1. drops the obsolete unique indexes (if present),
 *     2. re-sequences `order` (per roomId, createdAt asc, 0-based — matching
 *        the service's countDocuments-based assignment) and `version`
 *        (per roomId+fileName, createdAt asc, starting at 1), touching only
 *        documents whose value is inconsistent,
 *     3. creates the new unique indexes (if missing),
 *     4. drops the legacy non-unique `roomId+meetingSessionId+createdAt`
 *        index on both collections (write amplification; already covered by
 *        `roomId+createdAt`).
 *
 * When to run:
 *   Execute ONCE before deploying the room-scoped collaboration upgrade
 *   (i.e. while the old backend version is stopped or before the new one
 *   starts). The script is idempotent: re-running it is a no-op.
 *
 * Usage (from meet-ce/backend):
 *   node scripts/migrate-room-scoped-indexes.mjs --dry-run   # print plan only
 *   node scripts/migrate-room-scoped-indexes.mjs             # execute
 *
 * Environment:
 *   MONGO_URI      (default mongodb://localhost:27017)
 *   MONGO_DB_NAME  (default jmeet)
 */

import mongoose from 'mongoose';

const DRY_RUN = process.argv.includes('--dry-run');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'jmeet';

const AGENDAS = 'meetingagendas';
const MATERIALS = 'meetingmaterials';
const LEGACY_COMPOUND_INDEX = 'roomId_1_meetingSessionId_1_createdAt_-1';

const log = (msg) => console.log(`[${DRY_RUN ? 'DRY-RUN' : 'MIGRATE'}] ${msg}`);

async function collectionExists(db, name) {
	return db.listCollections({ name }, { nameOnly: true }).hasNext();
}

async function indexNames(db, collectionName) {
	const indexes = await db.collection(collectionName).indexes();
	return new Set(indexes.map((i) => i.name));
}

async function dropIndexIfExists(db, collectionName, indexName) {
	const names = await indexNames(db, collectionName);
	if (!names.has(indexName)) {
		log(`  ${collectionName}: index "${indexName}" not present, skip drop`);
		return;
	}
	if (DRY_RUN) {
		log(`  ${collectionName}: would drop index "${indexName}"`);
		return;
	}
	await db.collection(collectionName).dropIndex(indexName);
	log(`  ${collectionName}: dropped index "${indexName}"`);
}

async function createUniqueIndexIfMissing(db, collectionName, indexName, keys) {
	const names = await indexNames(db, collectionName);
	if (names.has(indexName)) {
		log(`  ${collectionName}: unique index "${indexName}" already exists, skip create`);
		return;
	}
	if (DRY_RUN) {
		log(`  ${collectionName}: would create unique index "${indexName}" ${JSON.stringify(keys)}`);
		return;
	}
	await db.collection(collectionName).createIndex(keys, { unique: true, name: indexName });
	log(`  ${collectionName}: created unique index "${indexName}" ${JSON.stringify(keys)}`);
}

/**
 * Re-sequences `field` within each `groupBy` bucket, ordering by createdAt asc
 * (_id asc as deterministic tie-breaker) and numbering from `startAt`.
 * Only documents whose stored value differs are updated. Each planned or
 * performed update is logged.
 */
async function resequence(db, collectionName, groupBy, field, startAt) {
	const groupProjection = Object.fromEntries(groupBy.map((f) => [f, 1]));
	const docs = await db
		.collection(collectionName)
		.find({}, { projection: { _id: 1, [field]: 1, ...groupProjection } })
		.sort({ createdAt: 1, _id: 1 })
		.toArray();
	const buckets = new Map();
	for (const doc of docs) {
		const key = groupBy.map((f) => `${f}=${String(doc[f])}`).join('|');
		if (!buckets.has(key)) buckets.set(key, []);
		buckets.get(key).push(doc);
	}
	const updates = [];
	for (const [key, bucket] of buckets) {
		let value = startAt;
		for (const doc of bucket) {
			if (doc[field] !== value) updates.push({ _id: doc._id, key, value });
			value += 1;
		}
	}
	if (updates.length === 0) {
		log(`  ${collectionName}: ${field} sequence already consistent across ${buckets.size} bucket(s), nothing to resequence`);
		return;
	}
	if (DRY_RUN) {
		log(`  ${collectionName}: would resequence ${updates.length} document(s) across ${buckets.size} bucket(s):`);
		for (const u of updates) log(`    _id=${String(u._id)} (${u.key}) -> ${field}=${u.value}`);
		return;
	}
	const coll = db.collection(collectionName);
	for (const u of updates) await coll.updateOne({ _id: u._id }, { $set: { [field]: u.value } });
	log(`  ${collectionName}: resequenced ${updates.length} document(s) across ${buckets.size} bucket(s)`);
}

async function migrateCollection(db, collectionName, plan) {
	log(`Collection "${collectionName}":`);
	if (!(await collectionExists(db, collectionName))) {
		log(`  collection does not exist, nothing to migrate (fresh installs create indexes via the app)`);
		return;
	}
	for (const drop of plan.drops) await dropIndexIfExists(db, collectionName, drop);
	await resequence(db, collectionName, plan.groupBy, plan.field, plan.startAt);
	await createUniqueIndexIfMissing(db, collectionName, plan.newIndexName, plan.newIndexKeys);
}

async function main() {
	console.log(`Room-scoped collaboration index migration (dry-run: ${DRY_RUN})`);
	console.log(`Connecting to ${MONGO_URI} db=${MONGO_DB_NAME} ...`);
	await mongoose.connect(MONGO_URI, { dbName: MONGO_DB_NAME });
	const db = mongoose.connection.db;

	await migrateCollection(db, AGENDAS, {
		drops: ['meetingSessionId_1_order_1', LEGACY_COMPOUND_INDEX],
		groupBy: ['roomId'],
		field: 'order',
		startAt: 0,
		newIndexName: 'roomId_1_order_1',
		newIndexKeys: { roomId: 1, order: 1 }
	});

	await migrateCollection(db, MATERIALS, {
		drops: ['meetingSessionId_1_fileName_1_version_1', LEGACY_COMPOUND_INDEX],
		groupBy: ['roomId', 'fileName'],
		field: 'version',
		startAt: 1,
		newIndexName: 'roomId_1_fileName_1_version_1',
		newIndexKeys: { roomId: 1, fileName: 1, version: 1 }
	});

	console.log('Migration finished.');
	await mongoose.disconnect();
}

main().catch(async (err) => {
	console.error('Migration failed:', err);
	try {
		await mongoose.disconnect();
	} catch {}
	process.exit(1);
});
