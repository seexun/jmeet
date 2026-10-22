import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { ParticipantService } from '../../../services/participant/participant.service';
import { StorageService } from '../../../services/storage/storage.service';

/**
 * @internal
 */
@Component({
	selector: 'ov-participant-name-input',
	imports: [FormsModule, NzIconModule, TranslatePipe],
	templateUrl: './participant-name-input.component.html',
	styleUrl: './participant-name-input.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true
})
export class ParticipantNameInputComponent implements OnInit {
	name = '';
	readonly isPrejoinPage = input(false);
	readonly error = input(false);
	readonly onNameUpdated = output<string>();
	readonly onEnterPressed = output<void>();

	private readonly participantService = inject(ParticipantService);
	private readonly storageSrv = inject(StorageService);

	ngOnInit(): void {
		this.subscribeToParticipantProperties();
		const myName = this.participantService.getMyName();
		const storedName = this.storageSrv.getParticipantName();

		this.name = myName ?? storedName ?? this.generateRandomName();

		if (!myName && !storedName) {
			this.storageSrv.setParticipantName(this.name);
		}

		this.onNameUpdated.emit(this.name);
	}

	/**
	 * As updating name requires that the participant has the `canUpdateOwnMetadata` to true in server side, which is a little bit insecure,
	 * we decided to not allow this feature for now.
	 */
	updateName() {
		if (this.isPrejoinPage()) {
			this.name = this.name ?? this.participantService.getMyName();
			// this.participantService.setMyName(this.name);
			this.storageSrv.setParticipantName(this.name);
			this.onNameUpdated.emit(this.name);
		}
	}

	/**
	 * @ignore
	 */
	eventKeyPress(event: KeyboardEvent) {
		// Pressed 'Enter' key
		if (event.key === 'Enter' && this.name) {
			event.preventDefault();
			this.updateName();
			this.onEnterPressed.emit();
		}
	}

	private subscribeToParticipantProperties() {
		// this.localParticipantSubscription = this.participantService.localParticipant$.subscribe((p: ParticipantModel | undefined) => {
		// 	if (p) {
		// 		this.name = p.name;
		// 	}
		// });
	}

	private generateRandomName(): string {
		return 'OpenVidu_User_' + Math.floor(Math.random() * 100);
	}
}
