import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import type { ApplicationConfig } from '@angular/core';
import { importProvidersFrom, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideNzI18n, zh_CN } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { registerLocaleData } from '@angular/common';
import zh from '@angular/common/locales/zh';
registerLocaleData(zh);
import { ceRoutes } from '@app/app.routes';
import { environment } from '@environment/environment';
import type { OpenViduComponentsConfig, ParticipantProperties } from '@openvidu-meet/shared-components';
import {
	AUTH_TRANSLATIONS,
	AuthHeaderProviderService,
	AuthInterceptorErrorHandlerService,
	APP_ICON_DEFINITIONS,
	CONSOLE_TRANSLATIONS,
	CustomParticipantModel,
	httpInterceptor,
	MeetingLayoutService,
	OpenViduComponentsModule,
	provideTranslations,
	ROOM_MEMBERS_TRANSLATIONS,
	RoomMemberHeaderProviderService,
	RoomMemberInterceptorErrorHandlerService,
	ROOMS_TRANSLATIONS,
	SHARED_TRANSLATIONS,
	SmartLayoutService,
	ThemeService,
	USERS_TRANSLATIONS
} from '@openvidu-meet/shared-components';

const ovComponentsconfig: OpenViduComponentsConfig = {
	production: environment.production,
	participantFactory: (props: ParticipantProperties) => new CustomParticipantModel(props)
};

export const appConfig: ApplicationConfig = {
	providers: [
		provideAppInitializer(() => inject(ThemeService).init()),
		provideAppInitializer(() => inject(RoomMemberHeaderProviderService).init()),
		// Important to register the room member error handler before the auth error handler,
		// since the room member error handler has more specific logic to determine if it can handle the error
		provideAppInitializer(() => inject(RoomMemberInterceptorErrorHandlerService).init()),
		provideAppInitializer(() => inject(AuthHeaderProviderService).init()),
		provideAppInitializer(() => inject(AuthInterceptorErrorHandlerService).init()),
		importProvidersFrom(OpenViduComponentsModule.forRoot(ovComponentsconfig)),
		provideTranslations(CONSOLE_TRANSLATIONS),
		provideTranslations(ROOMS_TRANSLATIONS),
		provideTranslations(USERS_TRANSLATIONS),
		provideTranslations(AUTH_TRANSLATIONS),
		provideTranslations(ROOM_MEMBERS_TRANSLATIONS),
		provideTranslations(SHARED_TRANSLATIONS),
		{ provide: SmartLayoutService, useExisting: MeetingLayoutService },
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideRouter(ceRoutes),
		provideAnimationsAsync(),
		provideNzI18n(zh_CN),
		importProvidersFrom(NzModalModule),
	provideNzIcons(APP_ICON_DEFINITIONS),
		provideHttpClient(withInterceptors([httpInterceptor])),
		{
			provide: STEPPER_GLOBAL_OPTIONS,
			useValue: { showError: true } // Show error messages in stepper
		}
	]
};
