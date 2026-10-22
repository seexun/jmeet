import { Container } from 'inversify';

import { BaseRepository } from '../repositories/base.repository.js';
import { GlobalConfigRepository } from '../repositories/global-config.repository.js';
import { MigrationRepository } from '../repositories/migration.repository.js';
import { RoomRepository } from '../repositories/room.repository.js';
import { RoomMemberRepository } from '../repositories/room-member.repository.js';
import { UserRepository } from '../repositories/user.repository.js';

/*
 * Services should be imported in order of use, starting with services
 * without dependencies and then the services that depend on others. This
 * helps avoid dependency cycles and ensures constructors receive the
 * dependencies already registered in the container.
 */
import { LoggerService } from '../services/logger.service.js';
import { RedisService } from '../services/redis.service.js';
import { DistributedEventService } from '../services/distributed-event.service.js';
import { MutexService } from '../services/mutex.service.js';
import { TaskSchedulerService } from '../services/task-scheduler.service.js';
import { BaseUrlService } from '../services/base-url.service.js';
import { RequestSessionService } from '../services/request-session.service.js';

import { MongoDBService } from '../services/storage/mongodb.service.js';

import { MigrationService } from '../services/migration.service.js';
import { TokenService } from '../services/token.service.js';
import { UserService } from '../services/user.service.js';
import { GlobalConfigService } from '../services/global-config.service.js';import { LiveKitService } from '../services/livekit.service.js';
import { FrontendEventService } from '../services/frontend-event.service.js';
import { RoomService } from '../services/room.service.js';
import { ParticipantNameService } from '../services/participant-name.service.js';
import { MeetingPresenceService } from '../services/meeting-presence.service.js';
import { RoomMemberService } from '../services/room-member.service.js';
import { MeetingHostService } from '../services/meeting-host.service.js';
import { LivekitWebhookService } from '../services/livekit-webhook.service.js';
import { RoomScheduledTasksService } from '../services/room-scheduled-tasks.service.js';
import { MeetingLifecycleService } from '../services/meeting-lifecycle.service.js';
import { ResourceQuotaService } from '../services/resource-quota.service.js';

export const container: Container = new Container();

/**
 * Registers all necessary dependencies in the container.
 *
 * This function is responsible for registering services and other dependencies
 * that are required by the application. It ensures that the dependencies are
 * available for injection throughout the application.
 *
 */
export const registerDependencies = () => {
	console.log('Registering CE dependencies');
	container.bind(LoggerService).toSelf().inSingletonScope();
	container.bind(RedisService).toSelf().inSingletonScope();
	container.bind(DistributedEventService).toSelf().inSingletonScope();
	container.bind(MutexService).toSelf().inSingletonScope();
	container.bind(TaskSchedulerService).toSelf().inSingletonScope();
	container.bind(BaseUrlService).toSelf().inSingletonScope();
	// RequestSessionService uses AsyncLocalStorage for request isolation
	// It's a singleton but provides per-request data isolation automatically
	container.bind(RequestSessionService).toSelf().inSingletonScope();

	container.bind(MongoDBService).toSelf().inSingletonScope();
	container.bind(BaseRepository).toSelf().inSingletonScope();
	container.bind(RoomRepository).toSelf().inSingletonScope();
	container.bind(RoomMemberRepository).toSelf().inSingletonScope();
	container.bind(UserRepository).toSelf().inSingletonScope();
	container.bind(GlobalConfigRepository).toSelf().inSingletonScope();
	container.bind(MigrationRepository).toSelf().inSingletonScope();

	container.bind(TokenService).toSelf().inSingletonScope();
	container.bind(UserService).toSelf().inSingletonScope();
	container.bind(GlobalConfigService).toSelf().inSingletonScope();
	container.bind(MigrationService).toSelf().inSingletonScope();

	container.bind(FrontendEventService).toSelf().inSingletonScope();
	container.bind(LiveKitService).toSelf().inSingletonScope();
	container.bind(RoomService).toSelf().inSingletonScope();
	container.bind(ParticipantNameService).toSelf().inSingletonScope();
	container.bind(MeetingPresenceService).toSelf().inSingletonScope();
	container.bind(RoomMemberService).toSelf().inSingletonScope();
	container.bind(MeetingHostService).toSelf().inSingletonScope();
	container.bind(LivekitWebhookService).toSelf().inSingletonScope();
	container.bind(RoomScheduledTasksService).toSelf().inSingletonScope();
	container.bind(MeetingLifecycleService).toSelf().inSingletonScope();
	container.bind(ResourceQuotaService).toSelf().inSingletonScope();
};

export const initializeEagerServices = async () => {
	// Connect to MongoDB and check health
	const mongoService = container.get(MongoDBService);
	await mongoService.connect();
	await mongoService.checkHealth();

	// Run migrations
	const migrationService = container.get(MigrationService);
	await migrationService.runMigrations();

	// Initialize the global config document and the default admin user
	// （原属企业版 storage-init 服务的职责，开源版内联到启动序列）
	await container.get(GlobalConfigService).initializeGlobalConfig();
	await container.get(UserService).initializeAdminUser();

	// Assign numeric meeting codes to rooms created before the join-by-code feature
	await container.get(RoomService).backfillMeetingCodes();

	// Initialize scheduled tasks services to register their cron jobs
	container.get(RoomScheduledTasksService);
};
