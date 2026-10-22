import type { StringValue } from 'ms';
import type { SchemaVersion } from '../models/migration.model.js';

export const INTERNAL_CONFIG = {
	// Base paths for the API
	API_BASE_PATH_V1: '/api/v1',
	INTERNAL_API_BASE_PATH_V1: '/internal-api/v1',

	// Headers names
	API_KEY_HEADER: 'x-api-key',
	ACCESS_TOKEN_HEADER: 'authorization',
	REFRESH_TOKEN_HEADER: 'x-refresh-token',
	ROOM_MEMBER_TOKEN_HEADER: 'x-room-member-token',

	// Token verification settings
	REFRESH_CLOCK_TOLERANCE_SECONDS: 10, // Time in seconds to allow for clock skew when validating token expiration


	// Cron job configuration
	CRON_JOB_LOCK_TTL: '59s' as StringValue, // Default TTL for cron job locks to avoid overlapping executions

	// Timing and cleanup settings for room lifecycle management
	ROOM_EXPIRED_GC_INTERVAL: '1h' as StringValue, // Interval for processing and deleting expired rooms
	ROOM_ACTIVE_VERIFICATION_GC_INTERVAL: '15m' as StringValue, // Interval for checking room 'active_meeting' status consistency

	// Timing and cleanup settings for recording lifecycle management
	RECORDING_STARTED_TIMEOUT: '20s' as StringValue, // Timeout for recording to be marked as started
	RECORDING_ACTIVE_LOCK_TTL: '7d' as StringValue, // Redis Lock TTL for active recording in a room
	RECORDING_ACTIVE_LOCK_GC_INTERVAL: '15m' as StringValue, // Interval for cleaning up stale active recording locks
	RECORDING_ORPHANED_ACTIVE_LOCK_GRACE_PERIOD: '30s' as StringValue, // Grace period to consider an active recording lock as orphaned (should be greater than RECORDING_STARTED_TIMEOUT)
	RECORDING_STALE_GC_INTERVAL: '14m' as StringValue, // Interval for cleaning up stale recordings (not updated recently)
		RECORDING_ORPHAN_GC_INTERVAL: '6h' as StringValue, // Interval for sweeping orphaned recordings whose room no longer exists
	RECORDING_STALE_GRACE_PERIOD: '5m' as StringValue, // Maximum allowed time since the last recording update before marking it as stale

	// Additional intervals
	MIN_ROOM_AUTO_DELETE_DURATION: '1h' as StringValue, // Minimum duration before a room can be auto-deleted
	MEETING_EMPTY_TIMEOUT: (process.env.MEETING_EMPTY_TIMEOUT || '20s') as StringValue, // Seconds to keep the meeting (LK room) open until the first participant joins
	MEETING_DEPARTURE_TIMEOUT: (process.env.MEETING_DEPARTURE_TIMEOUT || '20s') as StringValue, // Seconds to keep the meeting (LK room) open after the last participant leaves

	// Participant name reservation
	PARTICIPANT_MAX_CONCURRENT_NAME_REQUESTS: 20, // Maximum number of request by the same name at the same time allowed
	PARTICIPANT_NAME_RESERVATION_TTL: '12h' as StringValue, // Time-to-live for participant name reservations
	
	MEETING_PRESENCE_TTL: '32d' as StringValue, // Time-to-live for user/room presence mappings used to kick users from meetings

	CAPTIONS_AGENT_NAME: 'speech-processing',
	ASSISTANT_STATE_LOCK_TTL: '60s' as StringValue, // Redis lock TTL for AI assistant state (start/stop operations)

	// Batch and concurrency processing settings
	DEFAULT_CONCURRENCY: 10, // Default concurrency limit for concurrent operations
	BATCH_SIZE_ROOMS_EXPIRED_GC: 100, // Number of expired rooms to process per batch during GC
	BATCH_SIZE_ROOMS_STATUS_VALIDATION_GC: 100, // Number of active rooms to validate per batch during status consistency GC
	BATCH_SIZE_REGISTRY_LOCKS_RETRIEVAL: 100, // Number of recording locks to retrieve from registry in each batch during orphaned locks GC
	CONCURRENCY_VALIDATE_ROOMS_STATUS: 10, // Concurrency limit for validating and cleaning up inconsistent rooms
	CONCURRENCY_BULK_DELETE_ROOMS: 10, // Concurrency limit for bulk deleting rooms
	CONCURRENCY_BULK_RETRIEVE_ROOMS: 20, // Concurrency limit for bulk retrieving room info
	CONCURRENCY_BULK_DELETE_RECORDINGS: 20, // Concurrency limit for bulk deleting recordings
	CONCURRENCY_BULK_DELETE_ROOM_RECORDINGS: 10, // Concurrency limit for bulk deleting recordings of a room
	CONCURRENCY_BULK_RETRIEVE_RECORDINGS: 10, // Concurrency limit for bulk retrieving recording info
	CONCURRENCY_BULK_DELETE_STORAGE: 20, // Concurrency limit for bulk deleting objects in storage
	CONCURRENCY_BULK_KICK_MEMBERS: 20, // Concurrency limit for bulk kicking members from a room
	CONCURRENCY_BULK_UPDATE_PERMISSIONS: 20, // Concurrency limit for bulk updating room members' permissions
	CONCURRENCY_BULK_CLEANUP_USER_RESOURCES: 20, // Concurrency limit for bulk cleanup of user resources
	CONCURRENCY_BULK_CLEANUP_PARTICIPANT_NAME_RESERVATIONS: 20, // Concurrency limit for bulk cleanup of participant name reservations

	// MongoDB Schema Versions
	// These define the current schema version for each collection
	// Increment when making breaking changes to the schema structure
	// IMPORTANT: whenever you increment a schema version, update the MIGRATION_REV timestamp too.
	// This helps surface merge conflicts when multiple branches create schema migrations concurrently.
	GLOBAL_CONFIG_SCHEMA_VERSION: 6 as SchemaVersion, // MIGRATION_REV: 1786843107639
	USER_SCHEMA_VERSION: 2 as SchemaVersion, // MIGRATION_REV: 1774181859233
	API_KEY_SCHEMA_VERSION: 1 as SchemaVersion, // MIGRATION_REV: 1771328577054
	ROOM_SCHEMA_VERSION: 3 as SchemaVersion, // MIGRATION_REV: 1781616231619
	ROOM_MEMBER_SCHEMA_VERSION: 1 as SchemaVersion, // MIGRATION_REV: 1781616231619
	RECORDING_SCHEMA_VERSION: 3 as SchemaVersion // MIGRATION_REV: 1781616231619
};

// This function is used to set private configuration values for testing purposes.
// It allows you to override the default values defined in the INTERNAL_CONFIG object.
// This is useful for testing different scenarios without modifying the actual configuration file.
export const setInternalConfig = (overrides: Partial<typeof INTERNAL_CONFIG>): void => {
	Object.assign(INTERNAL_CONFIG, overrides);
};
