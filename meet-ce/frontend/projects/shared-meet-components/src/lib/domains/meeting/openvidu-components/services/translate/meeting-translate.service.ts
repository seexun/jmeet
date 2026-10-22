// The meeting now uses the single generic `TranslateService` from the shared layer. This alias is
// kept so the vendored openvidu-components import paths and DI token stay stable; `MeetingTranslateService`
// is the very same class (and therefore the same root singleton) as the generic `TranslateService`.
// The meeting's translations are registered via `provideTranslations(MEETING_TRANSLATIONS)` in
// `OpenViduComponentsModule.forRoot`.
export { TranslateService as MeetingTranslateService } from '../../../../../shared/services/i18n/translate.service';
