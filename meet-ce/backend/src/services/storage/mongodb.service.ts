import { inject, injectable } from 'inversify';
import mongoose from 'mongoose';
import { MEET_ENV } from '../../environment.js';
import { LoggerService } from '../logger.service.js';

/**
 * Service responsible for managing MongoDB connection lifecycle.
 * Handles connection, disconnection, and health checks for the MongoDB database.
 */
@injectable()
export class MongoDBService {
	private isConnected = false;
	private readonly connectionString: string;
	private readonly dbName: string;

	constructor(@inject(LoggerService) private logger: LoggerService) {
		this.connectionString = this.buildMongoConnectionString();
		this.dbName = MEET_ENV.MONGO_DB_NAME;
	}

	/**
	 * Builds MongoDB connection string from environment variables.
	 * Supports both single-node and replica set configurations.
	 *
	 * The `directConnection=true` parameter is only added for single-node connections
	 * to prevent the driver from attempting to discover other replica set members.
	 * In multi-node setups, it's omitted to enable automatic failover and load distribution.
	 *
	 * @returns MongoDB connection URI
	 */
	private buildMongoConnectionString(): string {
		const {
			MONGO_URI: mongoUri,
			MONGO_NODES: nodes,
			MONGO_PORT: port,
			MONGO_ADMIN_USERNAME: adminUser,
			MONGO_ADMIN_PASSWORD: adminPass,
			MONGO_REPLICA_SET_NAME: replicaSet
		} = MEET_ENV;

		if (mongoUri && mongoUri.trim() !== '') {
			this.logger.info('Using provided MongoDB URI from environment variable MEET_MONGO_URI');
			return mongoUri;
		}

		// Parse nodes and build host list
		const nodesList = nodes.split(',').map((node) => node.trim());
		const nodesAndPort = nodesList.map((node) => `${node}:${port}`).join(',');

		let connectionString = `mongodb://${adminUser}:${adminPass}@${nodesAndPort}/?replicaSet=${replicaSet}&readPreference=primaryPreferred`;

		// Add directConnection=true for single-node local connections
		const isLocalhost = nodesList.length === 1 && (nodesList[0] === 'localhost' || nodesList[0] === '127.0.0.1');

		if (isLocalhost) {
			connectionString += '&directConnection=true';
		}

		return connectionString;
	}

	/**
	 * Establishes connection to MongoDB database.
	 * @throws Error if connection fails
	 */
	async connect(): Promise<void> {
		if (this.isConnected) {
			this.logger.warn('MongoDB already connected, skipping connection attempt');
			return;
		}

		try {
			this.logger.info(`Connecting to MongoDB (database: ${this.dbName})...`);
			this.logger.info(`MongoDB connection pool: min=${MEET_ENV.MONGO_MIN_POOL_SIZE}, max=${MEET_ENV.MONGO_MAX_POOL_SIZE}`);

			await mongoose.connect(this.connectionString, {
				dbName: this.dbName,
				appName: MEET_ENV.NAME_ID,
				maxPoolSize: MEET_ENV.MONGO_MAX_POOL_SIZE,
				minPoolSize: MEET_ENV.MONGO_MIN_POOL_SIZE,
				connectTimeoutMS: MEET_ENV.MONGO_CONNECT_TIMEOUT_MS,
				socketTimeoutMS: MEET_ENV.MONGO_SOCKET_TIMEOUT_MS,
				serverSelectionTimeoutMS: MEET_ENV.MONGO_SERVER_SELECTION_TIMEOUT_MS,
				maxIdleTimeMS: MEET_ENV.MONGO_MAX_IDLE_TIME_MS
			});
			this.isConnected = true;
			this.logger.info(`Successfully connected to MongoDB (database: ${this.dbName})`);

			// Set up connection event listeners
			mongoose.connection.on('disconnected', () => {
				this.logger.warn('MongoDB disconnected');
				this.isConnected = false;
			});

			mongoose.connection.on('error', (error) => {
				this.logger.error('MongoDB connection error:', error);
			});

			mongoose.connection.on('reconnected', () => {
				this.logger.info('MongoDB reconnected');
				this.isConnected = true;
			});
		} catch (error) {
			this.logger.error('Failed to connect to MongoDB:', error);
			throw error;
		}
	}

	/**
	 * Closes the MongoDB connection gracefully.
	 */
	async disconnect(): Promise<void> {
		if (!this.isConnected) {
			this.logger.warn('MongoDB not connected, skipping disconnection');
			return;
		}

		try {
			await mongoose.disconnect();
			this.isConnected = false;
			this.logger.info('Disconnected from MongoDB');
		} catch (error) {
			this.logger.error('Error disconnecting from MongoDB:', error);
		}
	}

	async probeHealth(): Promise<boolean> {
		if (mongoose.connection.readyState !== 1) return false;
		const result = await mongoose.connection.db?.admin().ping();
		return result?.ok === 1;
	}

	/**
	 * Performs a health check on the MongoDB connection.
	 * Verifies both connection state and database accessibility.
	 * Terminates the process if MongoDB is not healthy.
	 */
	async checkHealth(): Promise<void> {
		try {
			// Check connection state
			if (mongoose.connection.readyState !== 1) {
				this.logger.error('MongoDB connection state is not ready:', mongoose.connection.readyState);
				this.logger.error('MongoDB is not healthy. Terminating application...');
				process.exit(1);
			}

			// Perform ping operation to verify database accessibility
			await mongoose.connection.db?.admin().ping();
			this.logger.info('MongoDB health check passed');
		} catch (error) {
			this.logger.error('MongoDB health check failed:', error);
			this.logger.error('MongoDB is not healthy. Terminating application...');
			process.exit(1);
		}
	}
}
