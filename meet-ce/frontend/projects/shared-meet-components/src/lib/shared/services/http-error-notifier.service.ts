import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable } from 'rxjs';

/**
 * Context information about an HTTP error
 */
export interface HttpErrorContext {
	/** The HTTP error response */
	error: HttpErrorResponse;
	/** The original HTTP request that caused the error */
	request: HttpRequest<unknown>;
	/** The current page URL where the error occurred */
	pageUrl: string;
	/** The next handler function to retry the request */
	next: HttpHandlerFn;
}

/**
 * Function type for error recovery handlers
 * Returns an Observable to retry the request if the handler can recover from the error, null otherwise
 */
// export type ErrorRecoveryHandler = (context: HttpErrorContext) => Observable<HttpEvent<unknown>> | null;
export interface HttpErrorHandler {
	/** Determines if this handler can handle the given error context */
	canHandle(context: HttpErrorContext): boolean;
	/** Handles the error and returns a recovery Observable */
	handle(context: HttpErrorContext): Observable<HttpEvent<unknown>>;
}

export interface ContinueWithNextHandlerError {
	continueWithNextHandler: boolean;
	error?: unknown;
}

/**
 * Service responsible for coordinating HTTP error recovery across domains.
 * This allows the interceptor to remain completely agnostic of domain logic.
 *
 * Domain handlers register themselves and provide recovery strategies when they can handle an error.
 */
@Injectable({
	providedIn: 'root'
})
export class HttpErrorNotifierService {
	private handlers: HttpErrorHandler[] = [];

	/**
	 * Registers a new HTTP error handler
	 *
	 * @param handler The error handler to register
	 */
	public register(handler: HttpErrorHandler): void {
		this.handlers.push(handler);
	}

	/**
	 * Attempts to recover from an HTTP error by consulting registered handlers.
	 * Returns an Observable from the first handler that can recover, or null if none can handle it.
	 *
	 * @param context The error context
	 * @returns Observable to retry the request, or null if no handler can recover
	 */
	public handle(context: HttpErrorContext): Observable<HttpEvent<unknown>> | null {
		const tryHandleFromIndex = (startIndex: number): Observable<HttpEvent<unknown>> | null => {
			for (let i = startIndex; i < this.handlers.length; i++) {
				const handler = this.handlers[i];
				if (!handler.canHandle(context)) {
					continue;
				}

				return handler.handle(context).pipe(
					catchError((err: unknown) => {
						// If the handler throws an error, we check if it's a special case where we want to continue to the next handler
						// instead of failing immediately.
						// This allows a handler to delegate to the next one if it determines that it cannot recover from the error after all.
						const shouldContinue = !!(
							err &&
							typeof err === 'object' &&
							'continueWithNextHandler' in err &&
							(err as ContinueWithNextHandlerError).continueWithNextHandler
						);

						if (!shouldContinue) {
							throw err;
						}

						const nextHandler$ = tryHandleFromIndex(i + 1);
						if (nextHandler$) {
							return nextHandler$;
						}

						const delegatedError = (err as ContinueWithNextHandlerError).error ?? err;
						throw delegatedError;
					})
				);
			}

			return null;
		};

		return tryHandleFromIndex(0);
	}
}
