import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';

/**
 * Component that displays an indicator for participants not visible in the current layout.
 * This appears as an extra participant tile when using the smart layout feature.
 */
@Component({
	selector: 'ov-hidden-participants-indicator',
	standalone: true,
	imports: [NzIconModule],
	templateUrl: './hidden-participants-indicator.component.html',
	styleUrl: './hidden-participants-indicator.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HiddenParticipantsIndicatorComponent {
	count = input<number>(0);
	hiddenParticipantNames = input<string[]>([]);
	clicked = output<void>();
	mode = input<'topbar' | 'standard'>('standard');

	protected isTopBarMode = computed(() => this.mode() === 'topbar');

	protected descriptionText = computed(() => {
		return this.count() === 1 ? 'more participant ' : 'more participants';
	});

	protected formattedParticipantNames = computed(() => {
		const names = this.hiddenParticipantNames();
		const total = this.count();

		if (!names || names.length === 0) {
			return '';
		}

		const maxNamesToShow = 3;
		const visibleNames = names.slice(0, maxNamesToShow);
		const remaining = total - visibleNames.length;

		if (remaining > 0) {
			return `${visibleNames.join(', ')} and ${remaining} more`;
		}

		return visibleNames.join(', ');
	});
}