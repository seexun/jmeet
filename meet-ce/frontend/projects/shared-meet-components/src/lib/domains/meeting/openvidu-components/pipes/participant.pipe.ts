import { Pipe, PipeTransform, inject } from '@angular/core';
import { ParticipantModel, ParticipantStream } from '../models/participant.model';
import { Track } from '../services/livekit-adapter';
import { MeetingTranslateService } from '../services/translate/meeting-translate.service';

/**
 * The **RemoteParticipantTracksPipe** flattens all remote participants into a single array of
 * {@link ParticipantStream} objects. Each stream groups the video and audio tracks for a single
 * visual element (camera stream or screen-share stream) so the layout can render one DOM
 * element per stream instead of one per track.
 * @returns {ParticipantStream[]} Flat array of participant streams
 */
@Pipe({ name: 'tracks', standalone: true })
export class RemoteParticipantTracksPipe implements PipeTransform {
	transform(participants: ParticipantModel[]): ParticipantStream[] {
		return participants.map((p) => p.streams()).flat();
	}
}

/**
 * @internal
 */
@Pipe({ name: 'tracksPublishedTypes', standalone: true })
export class TrackPublishedTypesPipe implements PipeTransform {
	private readonly translateService = inject(MeetingTranslateService);

	transform(participant: ParticipantModel): string {
		const trackTypes = participant?.getTracksPublishedTypes() ?? [];
		const types: string[] = [];
		trackTypes.forEach((source) => {
			if (source === Track.Source.Camera) {
				types.push(this.translateService.translate('PANEL.PARTICIPANTS.CAMERA'));
			} else if (source === Track.Source.Microphone) {
				types.push(this.translateService.translate('PANEL.PARTICIPANTS.MICROPHONE'));
			} else if (source === Track.Source.ScreenShare) {
				types.push(this.translateService.translate('PANEL.PARTICIPANTS.SCREEN'));
			}
		});
		if (types.length === 0) {
			return `(${this.translateService.translate('PANEL.PARTICIPANTS.NO_STREAMS')})`;
		}
		return `(${types.join(', ')})`;
	}
}
