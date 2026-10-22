import chalk from 'chalk';
import dotenv from 'dotenv';
import type { StringValue } from 'ms';

let envPath: string | undefined;

if (process.env.MEET_CONFIG_DIR) {
	envPath = process.env.MEET_CONFIG_DIR;
} else if (process.env.NODE_ENV === 'development') {
	envPath = '.env.dev';
} else if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'ci') {
	envPath = '.env.test';
} else {
	envPath = undefined;
}

dotenv.config(envPath ? { path: envPath } : {});

// Extract environment variables with defaults
export const MEET_ENV = {
	SERVER_PORT: process.env.SERVER_PORT || '6080',
	SERVER_CORS_ORIGIN: process.env.SERVER_CORS_ORIGIN || '*',
	SERVER_TRUST_PROXY: process.env.SERVER_TRUST_PROXY || 'true',
	LOG_LEVEL: process.env.MEET_LOG_LEVEL || 'info',
	NAME_ID: process.env.MEET_NAME_ID || 'jmeet',
	BASE_URL: process.env.MEET_BASE_URL ?? '',
	BASE_PATH: process.env.MEET_BASE_PATH || '/meet',
	EDITION: process.env.MEET_EDITION || 'CE',

	// Authentication configuration
	INITIAL_ADMIN_USER: process.env.MEET_INITIAL_ADMIN_USER || 'admin',
	INITIAL_ADMIN_PASSWORD: process.env.MEET_INITIAL_ADMIN_PASSWORD || 'admin',
	INITIAL_API_KEY: process.env.MEET_INITIAL_API_KEY ?? '',
	IDENTITY_ENCRYPTION_KEY: process.env.MEET_IDENTITY_ENCRYPTION_KEY ?? process.env.LIVEKIT_API_SECRET ?? 'secret',
	ACCESS_TOKEN_EXPIRATION: (process.env.MEET_ACCESS_TOKEN_EXPIRATION || '2h') as StringValue,
	REFRESH_TOKEN_EXPIRATION: (process.env.MEET_REFRESH_TOKEN_EXPIRATION || '1d') as StringValue,
	ROOM_MEMBER_TOKEN_EXPIRATION: (process.env.MEET_ROOM_MEMBER_TOKEN_EXPIRATION || '2h') as StringValue,
	PASSWORD_CHANGE_TOKEN_EXPIRATION: (process.env.MEET_PASSWORD_CHANGE_TOKEN_EXPIRATION || '15m') as StringValue,
	REFRESH_TOKEN_ROTATION_ENABLED: process.env.MEET_REFRESH_TOKEN_ROTATION_ENABLED || 'true',

	// LiveKit configuration
	LIVEKIT_URL: process.env.LIVEKIT_URL ?? 'ws://localhost:7880',
	LIVEKIT_URL_PRIVATE: process.env.LIVEKIT_URL_PRIVATE ?? process.env.LIVEKIT_URL ?? 'ws://localhost:7880',
	LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY ?? 'devkey',
	LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET ?? 'secret',

	// MongoDB configuration
	MONGO_ENABLED: process.env.MEET_MONGO_ENABLED || 'true',
	MONGO_URI: process.env.MEET_MONGO_URI ?? '',
	MONGO_NODES: process.env.MEET_MONGO_NODES ?? 'localhost',
	MONGO_PORT: process.env.MEET_MONGO_PORT ?? '27017',
	MONGO_ADMIN_USERNAME: process.env.MEET_MONGO_ADMIN_USERNAME ?? 'mongoadmin',
	MONGO_ADMIN_PASSWORD: process.env.MEET_MONGO_ADMIN_PASSWORD ?? 'mongoadmin',
	MONGO_REPLICA_SET_NAME: process.env.MEET_MONGO_REPLICA_SET_NAME ?? 'rs0',
	MONGO_DB_NAME: process.env.MEET_MONGO_DB_NAME ?? 'jmeet',
	// pool configuration
	MONGO_MAX_POOL_SIZE: parseInt(process.env.MEET_MONGO_MAX_POOL_SIZE ?? '100', 10),
	MONGO_MIN_POOL_SIZE: parseInt(process.env.MEET_MONGO_MIN_POOL_SIZE ?? '0', 10),
	// connection timeouts
	MONGO_SERVER_SELECTION_TIMEOUT_MS: parseInt(process.env.MEET_MONGO_SERVER_SELECTION_TIMEOUT_MS ?? '30000', 10),
	MONGO_CONNECT_TIMEOUT_MS: parseInt(process.env.MEET_MONGO_CONNECT_TIMEOUT_MS ?? '30000', 10),
	MONGO_SOCKET_TIMEOUT_MS: parseInt(process.env.MEET_MONGO_SOCKET_TIMEOUT_MS ?? '0', 10),
	MONGO_MAX_IDLE_TIME_MS: parseInt(process.env.MEET_MONGO_MAX_IDLE_TIME_MS ?? '0', 10),

	// Redis configuration
	REDIS_HOST: process.env.MEET_REDIS_HOST ?? 'localhost',
	REDIS_PORT: process.env.MEET_REDIS_PORT ?? '6379',
	REDIS_USERNAME: process.env.MEET_REDIS_USERNAME ?? '',
	REDIS_PASSWORD: process.env.MEET_REDIS_PASSWORD ?? 'redispassword',
	REDIS_DB: process.env.MEET_REDIS_DB ?? '0',

	// Redis Sentinel configuration
	REDIS_SENTINEL_HOST_LIST: process.env.MEET_REDIS_SENTINEL_HOST_LIST ?? '',
	REDIS_SENTINEL_PASSWORD: process.env.MEET_REDIS_SENTINEL_PASSWORD ?? '',
	REDIS_SENTINEL_MASTER_NAME: process.env.MEET_REDIS_SENTINEL_MASTER_NAME ?? 'jmeet',

	// Deployment configuration
	MODULES_FILE: process.env.MODULES_FILE || undefined,
	MODULE_NAME: process.env.MODULE_NAME || 'jmeet',
	ENABLED_MODULES: process.env.ENABLED_MODULES ?? ''
};

export function checkModuleEnabled() {
	if (MEET_ENV.MODULES_FILE) {
		const moduleName = MEET_ENV.MODULE_NAME;
		const enabledModules = MEET_ENV.ENABLED_MODULES.split(',').map((module) => module.trim());

		if (!enabledModules.includes(moduleName)) {
			console.error(`Module ${moduleName} is not enabled`);
			process.exit(0);
		}
	}

	// If MongoDB is not enabled, exit the process
	if (MEET_ENV.MONGO_ENABLED.toLowerCase() !== 'true') {
		console.error('MongoDB integration is not enabled. Exiting the process.');
		process.exit(0);
	}
}

export const logEnvVars = () => {
	const credential = chalk.yellow;
	const text = chalk.cyanBright;

	console.log(' ');
	console.log('---------------------------------------------------------');
	console.log(`JMeet ${MEET_ENV.EDITION} Server Configuration`);
	console.log('---------------------------------------------------------');
	console.log('SERVICE NAME ID: ', text(MEET_ENV.NAME_ID));
	console.log('CORS ORIGIN:', text(MEET_ENV.SERVER_CORS_ORIGIN));
	console.log('TRUST PROXY:', text(MEET_ENV.SERVER_TRUST_PROXY));
	console.log('LOG LEVEL: ', text(MEET_ENV.LOG_LEVEL));
	console.log('INITIAL ADMIN USER: ', credential('****' + MEET_ENV.INITIAL_ADMIN_USER.slice(-3)));
	console.log('INITIAL ADMIN PASSWORD: ', credential('****' + MEET_ENV.INITIAL_ADMIN_PASSWORD.slice(-3)));

	if (!MEET_ENV.INITIAL_API_KEY) {
		console.log(chalk.red('INITIAL API KEY: none'));
	} else {
		console.log('INITIAL API KEY: ', credential('****' + MEET_ENV.INITIAL_API_KEY.slice(-3)));
	}

	console.log('---------------------------------------------------------');
	console.log('LIVEKIT Configuration');
	console.log('---------------------------------------------------------');
	console.log('LIVEKIT URL: ', text(MEET_ENV.LIVEKIT_URL));
	console.log('LIVEKIT URL PRIVATE: ', text(MEET_ENV.LIVEKIT_URL_PRIVATE));
	console.log('LIVEKIT API SECRET: ', credential('****' + MEET_ENV.LIVEKIT_API_SECRET.slice(-3)));
	console.log('LIVEKIT API KEY: ', credential('****' + MEET_ENV.LIVEKIT_API_KEY.slice(-3)));
	console.log('---------------------------------------------------------');

	if (MEET_ENV.MONGO_URI === '') {
		console.log('MongoDB Configuration');
		console.log('---------------------------------------------------------');
		console.log('MONGODB NODES: ', text(MEET_ENV.MONGO_NODES));
		console.log('MONGODB PORT: ', text(MEET_ENV.MONGO_PORT));
		console.log('MONGODB ADMIN USERNAME: ', credential('****' + MEET_ENV.MONGO_ADMIN_USERNAME.slice(-3)));
		console.log('MONGODB ADMIN PASSWORD: ', credential('****' + MEET_ENV.MONGO_ADMIN_PASSWORD.slice(-3)));
		console.log('MONGODB REPLICA SET NAME: ', text(MEET_ENV.MONGO_REPLICA_SET_NAME));
		console.log('MONGODB DB NAME: ', text(MEET_ENV.MONGO_DB_NAME));
		console.log('---------------------------------------------------------');
	}

	console.log('Redis Configuration');
	console.log('---------------------------------------------------------');
	console.log('REDIS HOST:', text(MEET_ENV.REDIS_HOST));
	console.log('REDIS PORT:', text(MEET_ENV.REDIS_PORT));
	console.log('REDIS USERNAME:', credential('****' + MEET_ENV.REDIS_USERNAME.slice(-3)));
	console.log('REDIS PASSWORD:', credential('****' + MEET_ENV.REDIS_PASSWORD.slice(-3)));

	if (MEET_ENV.REDIS_SENTINEL_HOST_LIST !== '') {
		console.log('REDIS SENTINEL IS ENABLED');
		console.log('REDIS SENTINEL HOST LIST:', text(MEET_ENV.REDIS_SENTINEL_HOST_LIST));
	}

	console.log('---------------------------------------------------------');
	console.log(' ');
};
