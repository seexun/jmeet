import { TestBed } from '@angular/core/testing';
import { RuntimeConfigService } from './runtime-config.service';

describe('RuntimeConfigService - isIframeMode', () => {
	let service: RuntimeConfigService;

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [RuntimeConfigService] });
		service = TestBed.inject(RuntimeConfigService);
	});

	it('reflects whether the document is embedded in an iframe when not in webcomponent mode', () => {
		// Detection mirrors `window.self !== window.top`; derive the expectation the same way
		// so the assertion holds regardless of how the test runner frames the page.
		const embedded = window.self !== window.top;
		expect(service.isIframeMode()).toBe(embedded);
	});

	it('is false once webcomponent mode is enabled (the two embedded modes never overlap)', () => {
		service.enableWebcomponentMode();
		expect(service.isIframeMode()).toBeFalse();
	});

	it('is false after setServerBaseUrl, which also enables webcomponent mode', () => {
		service.setServerBaseUrl('https://meet.example.com');
		expect(service.isIframeMode()).toBeFalse();
	});
});
