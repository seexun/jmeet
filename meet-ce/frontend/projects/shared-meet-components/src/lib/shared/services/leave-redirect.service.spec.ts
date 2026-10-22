import { TestBed } from '@angular/core/testing';
import { LeaveRedirectService } from './leave-redirect.service';
import { RuntimeConfigService } from './runtime-config.service';
import { SessionStorageService } from './session-storage.service';

describe('LeaveRedirectService', () => {
	let service: LeaveRedirectService;
	let sessionStorage: { getRedirectUrl: jasmine.Spy; setRedirectUrl: jasmine.Spy };

	// Mutable per-test mode flags read by the runtime-config stub.
	let webcomponentMode: boolean;
	let iframeMode: boolean;

	beforeEach(() => {
		webcomponentMode = false;
		iframeMode = false;

		const runtimeConfigStub = {
			isWebcomponentMode: () => webcomponentMode,
			isIframeMode: () => iframeMode,
			isEmbeddedMode: () => webcomponentMode || iframeMode
		};
		sessionStorage = {
			getRedirectUrl: jasmine.createSpy('getRedirectUrl').and.returnValue(null),
			setRedirectUrl: jasmine.createSpy('setRedirectUrl')
		};

		TestBed.configureTestingModule({
			providers: [
				LeaveRedirectService,
				{ provide: RuntimeConfigService, useValue: runtimeConfigStub as unknown as RuntimeConfigService },
				{ provide: SessionStorageService, useValue: sessionStorage as unknown as SessionStorageService }
			]
		});

		service = TestBed.inject(LeaveRedirectService);
	});

	describe('handleLeaveRedirectUrl() — per-mode resolution', () => {
		let setSpy: jasmine.Spy;

		beforeEach(() => {
			// Spy on the (private) setter so we capture the resolved URL without
			// touching session storage or the real property.
			setSpy = spyOn(service as unknown as { setLeaveRedirectUrl: (u: string) => void }, 'setLeaveRedirectUrl');
		});

		afterEach(() => {
			// Drop any per-test override of the (normally read-only) document.referrer getter.
			delete (document as { referrer?: unknown }).referrer;
		});

		// Override the read-only `document.referrer` getter for the duration of a test; the referrer
		// resolution lives in the pure url.utils helpers, which read document.referrer directly.
		const stubReferrer = (value: string): void => {
			Object.defineProperty(document, 'referrer', { configurable: true, get: () => value });
		};

		it('uses an absolute URL as-is', () => {
			service.handleLeaveRedirectUrl('https://app.example.com/done');

			expect(setSpy).toHaveBeenCalledOnceWith('https://app.example.com/done');
		});

		it('webcomponent mode: resolves a relative path against window.location.origin', () => {
			webcomponentMode = true;

			service.handleLeaveRedirectUrl('/goodbye');

			expect(setSpy).toHaveBeenCalledOnceWith(`${window.location.origin}/goodbye`);
		});

		it('iframe mode: resolves a relative path against the referrer (host) origin', () => {
			iframeMode = true;
			stubReferrer('https://host.example.com/embedding-page');

			service.handleLeaveRedirectUrl('/goodbye');

			expect(setSpy).toHaveBeenCalledOnceWith('https://host.example.com/goodbye');
		});

		it('iframe mode: ignores a relative path when the referrer origin is unknown', () => {
			iframeMode = true;
			stubReferrer('');

			service.handleLeaveRedirectUrl('/goodbye');

			expect(setSpy).not.toHaveBeenCalled();
		});

		it('standalone SPA: auto-detects the redirect from the referrer when no URL is given', () => {
			// A referrer on a different origin than the test runner triggers auto-detection.
			stubReferrer('https://referrer.example.com/');

			service.handleLeaveRedirectUrl(undefined);

			expect(setSpy).toHaveBeenCalledOnceWith('https://referrer.example.com/');
		});

		it('iframe mode: does NOT auto-detect when no URL is given', () => {
			iframeMode = true;
			stubReferrer('https://referrer.example.com/');

			service.handleLeaveRedirectUrl(undefined);

			expect(setSpy).not.toHaveBeenCalled();
		});
	});

	describe('getLeaveRedirectURL()', () => {
		it('returns the resolved URL after handleLeaveRedirectUrl, and persists it', () => {
			service.handleLeaveRedirectUrl('https://app.example.com/done');

			expect(service.getLeaveRedirectURL()).toBe('https://app.example.com/done');
			expect(sessionStorage.setRedirectUrl).toHaveBeenCalledOnceWith('https://app.example.com/done');
		});

		it('falls back to the session-stored URL when none has been set in memory', () => {
			sessionStorage.getRedirectUrl.and.returnValue('https://stored.example.com/back');

			expect(service.getLeaveRedirectURL()).toBe('https://stored.example.com/back');
		});

		it('returns undefined when nothing is set or stored', () => {
			expect(service.getLeaveRedirectURL()).toBeUndefined();
		});
	});
});
