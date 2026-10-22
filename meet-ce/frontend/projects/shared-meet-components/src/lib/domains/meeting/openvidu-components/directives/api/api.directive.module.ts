import { NgModule } from '@angular/core';
import { ActivitiesPanelRecordingActivityDirective } from './activities-panel.directive';
import {
    E2EEKeyDirective,
    FallbackLogoDirective,
    LayoutRemoteParticipantsDirective,
    RecordingActivityViewRecordingsButtonDirective,
    StartStopRecordingButtonsDirective,
    ToolbarBrandingLogoDirective,
    ToolbarRoomNameDirective,
    ToolbarViewRecordingsButtonDirective
} from './internals.directive';
import { ParticipantPanelItemMuteButtonDirective } from './participant-panel-item.directive';
import {
    StreamDisplayAudioDetectionDirective,
    StreamDisplayParticipantNameDirective,
    StreamVideoControlsDirective
} from './stream.directive';
import {
    ToolbarActivitiesPanelButtonDirective,
    ToolbarAdditionalButtonsPossitionDirective,
    ToolbarBackgroundEffectsButtonDirective,
    ToolbarCameraButtonDirective,
    ToolbarChatPanelButtonDirective,
    ToolbarDisplayLogoDirective,
    ToolbarDisplayRoomNameDirective,
    ToolbarFullscreenButtonDirective,
    ToolbarLeaveButtonDirective,
    ToolbarMicrophoneButtonDirective,
    ToolbarParticipantsPanelButtonDirective,
    ToolbarRecordingButtonDirective,
    ToolbarScreenshareButtonDirective,
    ToolbarSettingsButtonDirective
} from './toolbar.directive';
import {
    AudioEnabledDirective,
    LangDirective,
    LangOptionsDirective,
    LivekitUrlDirective,
    ParticipantNameDirective,
    PrejoinDirective,
    RecordingStreamBaseUrlDirective,
    ShowDisconnectionDialogDirective,
    TokenDirective,
    TokenErrorDirective,
    VideoEnabledDirective
} from './videoconference.directive';

const directives = [
	LivekitUrlDirective,
	TokenDirective,
	TokenErrorDirective,
	LangDirective,
	LangOptionsDirective,
	PrejoinDirective,
	VideoEnabledDirective,
	AudioEnabledDirective,
	ShowDisconnectionDialogDirective,
	RecordingStreamBaseUrlDirective,
	ToolbarCameraButtonDirective,
	ToolbarMicrophoneButtonDirective,
	ToolbarScreenshareButtonDirective,
	ToolbarFullscreenButtonDirective,
	ToolbarBackgroundEffectsButtonDirective,
	ToolbarLeaveButtonDirective,
	ToolbarRecordingButtonDirective,
	ToolbarParticipantsPanelButtonDirective,
	ToolbarChatPanelButtonDirective,
	ToolbarActivitiesPanelButtonDirective,
	ToolbarDisplayRoomNameDirective,
	ToolbarDisplayLogoDirective,
	ToolbarSettingsButtonDirective,
	ToolbarAdditionalButtonsPossitionDirective,
	ToolbarViewRecordingsButtonDirective,
	StreamDisplayParticipantNameDirective,
	StreamDisplayAudioDetectionDirective,
	StreamVideoControlsDirective,
	FallbackLogoDirective,
	ToolbarBrandingLogoDirective,
	ParticipantPanelItemMuteButtonDirective,
	ParticipantNameDirective,
	ActivitiesPanelRecordingActivityDirective,
	LayoutRemoteParticipantsDirective,
	StartStopRecordingButtonsDirective,
	RecordingActivityViewRecordingsButtonDirective,
	ToolbarRoomNameDirective,
	E2EEKeyDirective
];

@NgModule({
	imports: [...directives],
	exports: [...directives]
})
export class ApiDirectiveModule {}
