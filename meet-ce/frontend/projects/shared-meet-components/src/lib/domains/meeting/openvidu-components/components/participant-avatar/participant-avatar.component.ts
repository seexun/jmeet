import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * Unified avatar component used in both the video poster (camera off) and the participants panel.
 *
 * Variants:
 * - `poster` — full-size overlay that fills the video tile when the camera is disabled.
 * - `panel`  — small circular avatar shown next to the participant name in the panel.
 *
 * Both variants show the participant initial and a pulsing accent ring when speaking.
 */
@Component({
	selector: 'ov-participant-avatar',
	imports: [NzIconModule, TranslatePipe],
	templateUrl: './participant-avatar.component.html',
	styleUrl: './participant-avatar.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	host: {
		'[class.participant-avatar]': 'true'
	}
})
export class ParticipantAvatarComponent {
	readonly nickname = input('');
	readonly color = input('#000000');
	readonly isSpeaking = input(false);
	readonly hasEncryptionError = input(false);
	readonly variant = input<'poster' | 'panel'>('panel');
	/** Poster-mode only: show the avatar when the video track is absent or the camera is disabled. */
	readonly showAvatar = input(true);

	readonly letter = computed(() => this.nickname()?.[0]?.toUpperCase() ?? '');
}
