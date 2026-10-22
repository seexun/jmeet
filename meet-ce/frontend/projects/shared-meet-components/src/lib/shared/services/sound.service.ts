import { inject, Injectable } from '@angular/core';
import { AssetsService } from './assets.service';

/**
 * Service responsible for managing sound effects within the application.
 */
@Injectable()
export class SoundService {
	private readonly assets = inject(AssetsService);

	constructor() {}

	/**
	 * Plays a sound to indicate that a participant has joined the meeting.
	 */
	playParticipantJoinedSound(): void {
		const audio = new Audio(this.assets.participantJoinedSound);
		audio.volume = 0.4;
		audio.play();
	}

	/**
	 * Plays a sound to indicate that a participant's role has been upgraded.
	 */
	playParticipantRoleUpgradedSound(): void {
		const audio = new Audio(this.assets.roleUpgradedSound);
		audio.volume = 0.4;
		audio.play();
	}

	/**
	 * Plays a sound to indicate that a participant's role has been downgraded.
	 */
	playParticipantRoleDowngradedSound(): void {
		const audio = new Audio(this.assets.roleDowngradedSound);
		audio.volume = 0.4;
		audio.play();
	}
}
