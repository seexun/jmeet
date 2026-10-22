import type { NextFunction, Request, Response } from 'express';
import { container } from '../config/dependency-injector.config.js';
import { RequestSessionService } from '../services/request-session.service.js';

/**
 * Middleware that initializes the AsyncLocalStorage context for each HTTP request.
 *
 * This middleware MUST be registered before any other middleware or route handler
 * that needs to access the RequestSessionService. It creates an isolated context
 * for the entire request lifecycle, ensuring that data stored in RequestSessionService
 * is unique to each request and doesn't leak between concurrent requests.
 *
 * How it works:
 * 1. Gets the singleton RequestSessionService from the container
 * 2. Calls requestSessionService.run() which creates a new AsyncLocalStorage context
 * 3. All subsequent code (middlewares, controllers) executed within this context
 *    will have access to the same isolated storage
 * 4. The context is automatically cleaned up when the request completes
 */
export const initRequestContext = (_req: Request, _res: Response, next: NextFunction) => {
	const requestSessionService = container.get(RequestSessionService);

	// Wrap the rest of the request handling in the AsyncLocalStorage context
	// All subsequent middlewares and route handlers will execute within this context
	requestSessionService.run(() => {
		next();
	});
};
