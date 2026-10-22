import { ChangeDetectionStrategy, Component, TemplateRef, viewChild } from '@angular/core';
import { MeetingParticipantItemContentComponent } from '../meeting-participant-item-content/meeting-participant-item-content.component';

/**
 * Exposes the participant-panel-item `TemplateRef` consumed by the OpenVidu components library.
 *
 * `MeetingComponent` reads this component's `template()` (via `contentChild`) and re-emits it through
 * the `*ovParticipantPanelItem` slot of `<ov-videoconference>`, so the participants panel stamps the
 * template once per participant. The template delegates to {@link MeetingParticipantItemContentComponent},
 * which therefore gets one instance per participant and owns all per-participant rendering and logic.
 */
@Component({
	selector: 'ov-meeting-participant-item',
	templateUrl: './meeting-participant-item.component.html',
	imports: [MeetingParticipantItemContentComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingParticipantItemComponent {
	// Template reference for the participant panel item, consumed by the OpenVidu library.
	readonly template = viewChild.required<TemplateRef<any>>('template');
}
