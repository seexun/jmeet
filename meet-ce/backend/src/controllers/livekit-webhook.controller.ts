import type { Request, Response } from 'express';
import type { WebhookEvent } from 'livekit-server-sdk';
import ms from 'ms';
import { container } from '../config/dependency-injector.config.js';
import { MeetLock } from '../helpers/redis.helper.js';
import { LivekitWebhookService } from '../services/livekit-webhook.service.js';
import { LoggerService } from '../services/logger.service.js';
import { MutexService } from '../services/mutex.service.js';

export const lkWebhookHandler = async (req: Request, res: Response) => {
	const logger = container.get(LoggerService);
	const mutexService = container.get(MutexService);

	try {
		const lkWebhookService = container.get(LivekitWebhookService);
		const webhookEvent: WebhookEvent = await lkWebhookService.getEventFromWebhook(
			req.body,
			req.get('Authorization')!
		);

		const webhookLockKey = MeetLock.getWebhookLock(webhookEvent);
		const belongsToOpenViduMeet = await lkWebhookService.webhookEventBelongsToOpenViduMeet(webhookEvent);

		if (!belongsToOpenViduMeet) {
			logger.verbose(`Webhook skipped: ${webhookEvent.event}. Not related to JMeet.`);
			return;
		}

		const executionResult = await mutexService.withLock(webhookLockKey, ms('5s'), async () => {
			const { event: eventType, room, participant } = webhookEvent;

			logger.info(`Webhook received: ${eventType}`);
			logger.debug(`Webhook event object: ${JSON.stringify(webhookEvent, null, 2)}`);

			switch (eventType) {
				case 'participant_joined':
					await lkWebhookService.handleParticipantJoined(room!, participant!);
					break;
				case 'participant_left':
					await lkWebhookService.handleParticipantLeft(room!, participant!);
					break;
				case 'room_started':
					await lkWebhookService.handleRoomStarted(room!);
					break;
				case 'room_finished':
					await lkWebhookService.handleRoomFinished(room!);
					break;
				default:
					break;
			}

			return true;
		});

		if (executionResult === null) {
			logger.debug(`Webhook processing skipped: another instance is already processing '${webhookLockKey}'`);
			return res.status(200).send();
		}
	} catch (error) {
		logger.error(`Error handling webhook event: ${error}`);
	}

	return res.status(200).send();
};
