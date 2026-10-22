import express, { Router } from 'express';
import { lkWebhookHandler } from '../controllers/livekit-webhook.controller.js';

export const livekitWebhookRouter: Router = Router();
livekitWebhookRouter.use(express.raw({ type: 'application/webhook+json' }));

livekitWebhookRouter.post('/', lkWebhookHandler);
