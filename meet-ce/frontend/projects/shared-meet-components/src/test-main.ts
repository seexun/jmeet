/**
 * Karma test entry-point (main) for both test targets: `openvidu-meet` and
 * `shared-meet-components`.
 *
 * It mirrors the builder's built-in main file and additionally mirrors the
 * application bootstrap (src/app/app.config.ts `provideNzIcons`): the full
 * icon set is registered once on the test environment module so every spec
 * renders nz-icon offline. Without it, any nz-icon rendered in a test throws
 * `IconNotFoundError` asynchronously; the error surfaces in a later jasmine
 * hook, fails `afterAll`, and aborts the whole karma run.
 */
import { provideZoneChangeDetection, ɵcompileNgModuleDefs as compileNgModuleDefs } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { NZ_ICONS } from 'ng-zorro-antd/icon';
import { APP_ICON_DEFINITIONS } from './lib/shared/icons/nz-icons';

const providers = [];
if (typeof (globalThis as { Zone?: unknown }).Zone !== 'undefined') {
	providers.push(provideZoneChangeDetection());
}
providers.push({ provide: NZ_ICONS, useValue: APP_ICON_DEFINITIONS });

export class TestModule {}

// compileNgModuleDefs attaches the ɵmod metadata the cast below requires.
compileNgModuleDefs(TestModule as Parameters<typeof compileNgModuleDefs>[0], { providers });

// Initialize the Angular testing environment.
getTestBed().initTestEnvironment([BrowserTestingModule, TestModule], platformBrowserTesting(), {
	errorOnUnknownElements: true,
	errorOnUnknownProperties: true
});
