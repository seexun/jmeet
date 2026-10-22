import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * @internal
 */
@Component({
	selector: 'ov-audio-wave',
	template: `
		<div class="audio-container audio-wave-indicator">
			<div class="stick normal play"></div>
			<div class="stick loud play"></div>
			<div class="stick normal play"></div>
		</div>
	`,
	styleUrl: './audio-wave.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class AudioWaveComponent {}
