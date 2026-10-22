import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { HttpErrorNotifierService, HttpHeaderProviderService } from '../services';

/**
 * This interceptor follows the principle of single responsibility and domain separation.
 * It only handles:
 * 1. Collecting headers from registered domain providers
 * 2. Detecting HTTP errors
 * 3. Delegating error to registered domain handlers
 */
export const httpInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
	const router = inject(Router);
	const httpErrorNotifier = inject(HttpErrorNotifierService);
	const httpHeaderProvider = inject(HttpHeaderProviderService);

	// Route the header providers and error handlers act on.
	const pageUrl = router.currentNavigation()?.finalUrl?.toString() || router.url;

	// Collect headers from all registered providers
	const headers = httpHeaderProvider.collectHeaders({ request: req, pageUrl });
	if (headers) {
		req = req.clone({ setHeaders: headers });
	}

	return next(req).pipe(
		catchError((error: HttpErrorResponse) => {
			// Attempt recovery through registered domain handlers
			const responseHandler$ = httpErrorNotifier.handle({
				error,
				request: req,
				pageUrl,
				next
			});

			// If a handler provided a response Observable, return it
			// Otherwise, rethrow the error
			if (responseHandler$) {
				return responseHandler$;
			}

			return throwError(() => error);
		})
	);
};
