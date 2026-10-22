import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AudioWaveComponent } from './components/audio-wave/audio-wave.component';
import { SmartLayoutComponent } from './components/layout/smart-layout/smart-layout.component';
import { VideoElementComponent } from './components/video-element/video-element.component';
import { ChatPanelComponent } from './components/panel/chat-panel/chat-panel.component';
import { SessionComponent } from './components/session/session.component';
import { StreamComponent } from './components/stream/stream.component';
import { ToolbarMediaButtonsComponent } from './components/toolbar/toolbar-media-buttons/toolbar-media-buttons.component';
import { ToolbarPanelButtonsComponent } from './components/toolbar/toolbar-panel-buttons/toolbar-panel-buttons.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';

import { LinkifyPipe } from './pipes/linkify.pipe';
import { RemoteParticipantTracksPipe, TrackPublishedTypesPipe } from './pipes/participant.pipe';
import { DurationFromSecondsPipe } from './pipes/recording.pipe';
import { TranslatePipe } from './pipes/translate.pipe';

import { DragDropModule } from '@angular/cdk/drag-drop';
import { PanelComponent } from './components/panel/panel.component';
import { ParticipantPanelItemComponent } from './components/panel/participants-panel/participant-panel-item/participant-panel-item.component';
import { ParticipantsPanelComponent } from './components/panel/participants-panel/participants-panel/participants-panel.component';
import { PreJoinComponent } from './components/pre-join/pre-join.component';
import { VideoconferenceComponent } from './components/videoconference/videoconference.component';

import { LandscapeWarningComponent } from './components/landscape-warning/landscape-warning.component';
import { ActivitiesPanelComponent } from './components/panel/activities-panel/activities-panel.component';
import { RecordingActivityComponent } from './components/panel/activities-panel/recording-activity/recording-activity.component';
import { BackgroundEffectsPanelComponent } from './components/panel/background-effects-panel/background-effects-panel.component';
import { SettingsPanelComponent } from './components/panel/settings-panel/settings-panel.component';
import { AudioDevicesComponent } from './components/settings/audio-devices/audio-devices.component';
import { LangSelectorComponent } from './components/settings/lang-selector/lang-selector.component';
import { ParticipantNameInputComponent } from './components/settings/participant-name-input/participant-name-input.component';
import { VideoDevicesComponent } from './components/settings/video-devices/video-devices.component';
import { ParticipantAvatarComponent } from './components/participant-avatar/participant-avatar.component';
import { ApiDirectiveModule } from './directives/api/api.directive.module';
import { OpenViduComponentsDirectiveModule } from './directives/template/openvidu-components-angular.directive.module';

const publicComponents = [
	VideoconferenceComponent,
	ToolbarComponent,
	PanelComponent,
	ParticipantsPanelComponent,
	ChatPanelComponent,
	StreamComponent,
	SmartLayoutComponent
];
const declaredPublicComponents: any[] = [];
const privateComponents: any[] = [];

@NgModule({
	declarations: [...declaredPublicComponents, ...privateComponents],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		LinkifyPipe,
		RemoteParticipantTracksPipe,
		DurationFromSecondsPipe,
		TrackPublishedTypesPipe,
		AudioWaveComponent,
		LandscapeWarningComponent,
		AudioDevicesComponent,
		LangSelectorComponent,
		ParticipantNameInputComponent,
		VideoDevicesComponent,
		ParticipantAvatarComponent,
		VideoElementComponent,
		ToolbarMediaButtonsComponent,
		ToolbarPanelButtonsComponent,
		StreamComponent,
		PreJoinComponent,
		SmartLayoutComponent,
		PanelComponent,
		ToolbarComponent,
		ActivitiesPanelComponent,
		ParticipantPanelItemComponent,
		ParticipantsPanelComponent,
		ChatPanelComponent,
		BackgroundEffectsPanelComponent,
		SettingsPanelComponent,
		RecordingActivityComponent,
		SessionComponent,
		VideoconferenceComponent,
		TranslatePipe,
		OpenViduComponentsDirectiveModule,
		ApiDirectiveModule,
		DragDropModule
	],
	exports: [
		...publicComponents,
		ParticipantPanelItemComponent,
		RemoteParticipantTracksPipe,
		DurationFromSecondsPipe,
		TrackPublishedTypesPipe,
		TranslatePipe,
		OpenViduComponentsDirectiveModule,
		ApiDirectiveModule
	]
})
export class OpenViduComponentsUiModule {}
