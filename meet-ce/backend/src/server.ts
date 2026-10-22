import chalk from 'chalk';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import type { Express, Request, Response, Router } from 'express';
import express from 'express';
import { initializeEagerServices, registerDependencies } from './config/dependency-injector.config.js';
import { INTERNAL_CONFIG } from './config/internal-config.js';
import { MEET_ENV, logEnvVars } from './environment.js';
import { setBaseUrlFromRequest } from './middlewares/base-url.middleware.js';
import { jsonSyntaxErrorHandler } from './middlewares/content-type.middleware.js';
import { initRequestContext } from './middlewares/request-context.middleware.js';
import { authRouter } from './routes/auth.routes.js';
import { configRouter } from './routes/global-config.routes.js';
import { livekitWebhookRouter } from './routes/livekit.routes.js';
import { internalMeetingRouter } from './routes/meeting.routes.js';
import { internalRoomRouter, roomRouter } from './routes/room.routes.js';
import { internalUserRouter, userRouter } from './routes/user.routes.js';
import { getBasePath, getHtmlWithBasePath, getOpenApiHtmlWithBasePath } from './utils/html-dynamic-base-path.utils.js';
import { frontendDirectoryPath, frontendHtmlPath, internalApiHtmlFilePath } from './utils/path.utils.js';

const createApp = () => {
	const app: Express = express();
	const basePath = getBasePath();

	// Compress responses. Also shrinks API JSON, the served HTML and the SPA's static chunks.
	app.use(compression());

	// Enable CORS support
	if (MEET_ENV.SERVER_CORS_ORIGIN) {
		app.use(
			cors({
				origin: MEET_ENV.SERVER_CORS_ORIGIN,
				credentials: true
			})
		);
	}

	// Configure trust proxy based on deployment topology
	// This is important for rate limiting and getting the real client IP
	// Can be: true, false, a number (hops), or a custom function/string
	const trustProxyValue = MEET_ENV.SERVER_TRUST_PROXY;
	const parsedTrustProxy = /^\d+$/.test(trustProxyValue)
		? parseInt(trustProxyValue, 10)
		: trustProxyValue === 'true'
			? true
			: trustProxyValue === 'false'
				? false
				: trustProxyValue;
	app.set('trust proxy', parsedTrustProxy);

	app.use(express.json());
	app.use(jsonSyntaxErrorHandler);
	app.use(cookieParser());

	// CRITICAL: Initialize request context FIRST
	// This middleware creates an isolated AsyncLocalStorage context for each request
	// Must be registered before any middleware that uses RequestSessionService
	app.use(initRequestContext);

	// Middleware to set base URL for each request
	// Only if BASE_URL is not set
	if (!MEET_ENV.BASE_URL) {
		app.use(setBaseUrlFromRequest);
	}

	// Create a router for all app routes (to be mounted under base path)
	const appRouter: Router = express.Router();

	// Serve static files (disable automatic index.html serving so our catch-all can inject config)
	appRouter.use(express.static(frontendDirectoryPath, { index: false }));

	// 应用 API 路由（access token 鉴权，服务内置控制台；API Key 集成鉴权属企业版能力）
	appRouter.use(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/users`, userRouter);
	appRouter.use(`${INTERNAL_CONFIG.API_BASE_PATH_V1}/rooms`, roomRouter);

	// Internal API routes
	if (process.env.NODE_ENV === 'development') {
		// Serve internal API docs only in development mode
		appRouter.use(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/docs`, (_req: Request, res: Response) =>
			res
				.type('html')
				.send(getOpenApiHtmlWithBasePath(internalApiHtmlFilePath, INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1))
		);
	}

	appRouter.use(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/auth`, authRouter);
	appRouter.use(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/users`, internalUserRouter);
	appRouter.use(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/rooms`, internalRoomRouter);
	appRouter.use(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/meetings`, internalMeetingRouter);
	appRouter.use(`${INTERNAL_CONFIG.INTERNAL_API_BASE_PATH_V1}/config`, configRouter);

	appRouter.use('/health', (_req: Request, res: Response) => res.status(200).send('OK'));

	// Serve JMeet index.html file for all non-API routes (with dynamic base path injection)
	appRouter.get(/^(?!.*\/(api|internal-api)\/).*$/, (_req: Request, res: Response) => {
		// 入口页永不缓存：index 每次构建引用新 hash 的资源，入口被 304 协商缓存
		// 卡住会让用户长期停留在旧 bundle（资源本身仍可长缓存，由内容 hash 保证）
		res.set('Cache-Control', 'no-store');
		res.type('html').send(getHtmlWithBasePath(frontendHtmlPath));
	});
	// Catch all other routes and return 404
	appRouter.use((_req: Request, res: Response) =>
		res.status(404).json({ error: 'Path Not Found', message: '接口路径未实现' })
	);

	// LiveKit Webhook route - mounted directly on app (not under base path)
	// This allows webhooks to always be received at /livekit/webhook regardless of base path configuration
	app.use('/livekit/webhook', livekitWebhookRouter);

	// Mount all routes under the configured base path
	app.use(basePath, appRouter);

	return app;
};

const startServer = (app: express.Application) => {
	const basePath = getBasePath();

	const server = app.listen(MEET_ENV.SERVER_PORT, () => {
		console.log(' ');
		console.log('---------------------------------------------------------');
		console.log(' ');

		console.log(`JMeet ${MEET_ENV.EDITION} is listening on port`, chalk.cyanBright(MEET_ENV.SERVER_PORT));

		if (basePath !== '/') {
			console.log('Base Path:', chalk.cyanBright(basePath));
		}

		logEnvVars();
	});

	server.on('error', (error: Error) => {
		console.error('Server failed to start:', error.message);
		process.exit(1);
	});
};

/**
 * Determines if the current module is the main entry point of the application.
 * @returns {boolean} True if the current module is the main entry point, false otherwise.
 */
const isMainModule = (): boolean => {
	const importMetaUrl = import.meta.url;
	let processArgv1 = process.argv[1];

	if (process.platform === 'win32') {
		processArgv1 = processArgv1.replace(/\\/g, '/');
		processArgv1 = `file:///${processArgv1}`;
	} else {
		processArgv1 = `file://${processArgv1}`;
	}

	return importMetaUrl === processArgv1;
};

if (isMainModule()) {
	registerDependencies();
	const app = createApp();
	await initializeEagerServices();
	startServer(app);
}

export { createApp, registerDependencies };
