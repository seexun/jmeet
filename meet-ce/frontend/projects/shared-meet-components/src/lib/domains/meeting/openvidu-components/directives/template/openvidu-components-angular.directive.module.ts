import { NgModule } from '@angular/core';
import {
	ChatPanelDirective,
	LayoutDirective,
	PanelDirective,
	ParticipantPanelItemElementsDirective,
	ParticipantPanelItemDirective,
	ParticipantsPanelDirective,
	MediaQualityPanelDirective,
	StreamDirective,
	ToolbarAdditionalButtonsDirective,
	ToolbarDirective,
	ToolbarAdditionalPanelButtonsDirective,
	AdditionalPanelsDirective,
	ActivitiesPanelDirective,
	BackgroundEffectsPanelDirective
} from './openvidu-components-angular.directive';
import {
	LayoutAdditionalElementsDirective,
	ParticipantPanelAfterLocalParticipantDirective,
	ParticipantPanelParticipantBadgeDirective,
	PreJoinDirective,
	LeaveButtonDirective,
	SettingsPanelGeneralAdditionalElementsDirective,
	ToolbarMoreOptionsAdditionalMenuItemsDirective
} from './internals.directive';

const directives = [
	ChatPanelDirective,
	LayoutDirective,
	PanelDirective,
	AdditionalPanelsDirective,
	ParticipantPanelItemDirective,
	ParticipantsPanelDirective,
	MediaQualityPanelDirective,
	StreamDirective,
	ToolbarDirective,
	ToolbarAdditionalButtonsDirective,
	LeaveButtonDirective,
	ToolbarAdditionalPanelButtonsDirective,
	ParticipantPanelItemElementsDirective,
	ActivitiesPanelDirective,
	PreJoinDirective,
	ParticipantPanelAfterLocalParticipantDirective,
	LayoutAdditionalElementsDirective,
	ParticipantPanelParticipantBadgeDirective,
	SettingsPanelGeneralAdditionalElementsDirective,
	ToolbarMoreOptionsAdditionalMenuItemsDirective
];

@NgModule({
	imports: [...directives],
	exports: [...directives]
})
export class OpenViduComponentsDirectiveModule {}
