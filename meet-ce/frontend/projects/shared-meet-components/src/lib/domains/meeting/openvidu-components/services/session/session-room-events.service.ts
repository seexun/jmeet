import { inject, Injectable, signal } from '@angular/core';
import {
	MeetingChatSignalPayload,
	MeetRecordingStatus,
	MeetRecordingUpdatedPayload,
	MeetSignalType
} from '@openvidu-meet/typings';
import { DataTopic } from '../../models/data-topic.model';
import { ParticipantLeftEvent, ParticipantLeftReason } from '../../models/participant.model';
import {
	ConnectionQuality,
	DataPacket_Kind,
	DisconnectReason,
	LocalParticipant,
	Participant,
	RemoteParticipant,
	RemoteTrack,
	RemoteTrackPublication,
	Room,
	RoomEvent,
	Track,
	TrackPublication
} from '../../services/livekit-adapter';
import { safeJsonParse } from '../../utils/utils';
import { ActionService } from '../action/action.service';
import { ChatService } from '../chat/chat.service';
import { OpenViduComponentsConfigService } from '../config/directive-config.service';
import { LoggerService } from '../logger/logger.service';
import { OpenViduService } from '../openvidu/openvidu.service';
import { ParticipantService } from '../participant/participant.service';
import { RecordingService } from '../recording/recording.service';
import { MeetingTranslateService } from '../translate/meeting-translate.service';

export interface SessionRoomEventCallbacks {
	onRoomReconnecting: () => void;
	onRoomReconnected: () => void;
	onParticipantLeft: (event: ParticipantLeftEvent) => void;
}

@Injectable({ providedIn: 'root' })
export class SessionRoomEventsService {
	private readonly actionService = inject(ActionService);
	private readonly chatService = inject(ChatService);
	private readonly libService = inject(OpenViduComponentsConfigService);
	private readonly loggerSrv = inject(LoggerService);
	private readonly openviduService = inject(OpenViduService);
	private readonly participantService = inject(ParticipantService);
	private readonly recordingService = inject(RecordingService);
	private readonly translateService = inject(MeetingTranslateService);
	private readonly log = this.loggerSrv.get('SessionRoomEventsService');
	private readonly _activeSpeakers = signal<Participant[]>([]);
	readonly activeSpeakers = this._activeSpeakers.asReadonly();

	bindRoom(room: Room, callbacks: SessionRoomEventCallbacks): void {
		this._activeSpeakers.set([]);
		this.subscribeToEncryptionErrors(room);
		this.subscribeToActiveSpeakersChanged(room);
		this.subscribeToParticipantConnected(room);
		this.subscribeToTrackPublished(room);
		this.subscribeToTrackSubscribed(room);
		this.subscribeToTrackUnpublished(room);
		this.subscribeToTrackUnsubscribed(room);
		this.subscribeToTrackMuteStateChanged(room);
		this.subscribeToParticipantDisconnected(room);
		this.subscribeToParticipantMetadataChanged(room);
		this.subscribeToDataMessage(room);
		this.subscribeToReconnection(room, callbacks);
		this.subscribeToConnectionQualityChanged(room);
	}

	private subscribeToEncryptionErrors(room: Room) {
		room.on(RoomEvent.EncryptionError, (error: Error, participant?: Participant) => {
			if (!participant) {
				this.log.w('Encryption error received without participant info:', error);
				return;
			}
			this.participantService.setEncryptionError(participant.sid, true);
		});
	}

	private subscribeToActiveSpeakersChanged(room: Room) {
		room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
			this._activeSpeakers.set(speakers);
			this.participantService.setSpeaking(speakers);
		});
	}

	private subscribeToParticipantConnected(room: Room) {
		room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
			this.participantService.addRemoteParticipant(participant);
		});
	}

	private subscribeToTrackPublished(room: Room) {
		room.on(RoomEvent.TrackPublished, (_publication: RemoteTrackPublication, participant: RemoteParticipant) => {
			this.participantService.addRemoteParticipant(participant);
		});
	}

	private subscribeToTrackSubscribed(room: Room) {
		room.on(
			RoomEvent.TrackSubscribed,
			(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
				const isScreenTrack = track.source === Track.Source.ScreenShare;
				this.participantService.addRemoteParticipant(participant);
				if (isScreenTrack) {
					this.participantService.resetLocalStreamsToNormalSize();
					this.participantService.resetRemoteStreamsToNormalSize();
					this.participantService.toggleRemoteVideoPinned(track.sid);
					if (track.sid) {
						this.participantService.setScreenTrackPublicationDate(
							participant.sid,
							track.sid,
							new Date().getTime()
						);
					}
				}
			}
		);
	}

	private subscribeToTrackUnsubscribed(room: Room) {
		room.on(
			RoomEvent.TrackUnsubscribed,
			(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
				this.log.d('TrackUnSubscribed', track, participant);
				const isScreenTrack = track.source === Track.Source.ScreenShare;
				if (isScreenTrack) {
					if (track.sid) {
						this.participantService.setScreenTrackPublicationDate(participant.sid, track.sid, -1);
					}
					this.participantService.resetLocalStreamsToNormalSize();
					this.participantService.resetRemoteStreamsToNormalSize();
					this.participantService.setLastScreenPinned();
				}

				if (track.sid) {
					this.participantService.removeRemoteParticipantTrack(participant, track.sid);
				}
			}
		);
	}

	private subscribeToTrackUnpublished(room: Room) {
		room.on(RoomEvent.TrackUnpublished, (_publication: RemoteTrackPublication, participant: RemoteParticipant) => {
			this.participantService.addRemoteParticipant(participant);
		});
	}

	private subscribeToTrackMuteStateChanged(room: Room) {
		const refreshParticipantState = (participant: Participant | RemoteParticipant | LocalParticipant) => {
			if (!participant) return;

			if (participant.isLocal) {
				this.participantService.updateLocalParticipant();
				return;
			}

			this.participantService.addRemoteParticipant(participant as RemoteParticipant);
		};

		room.on(RoomEvent.TrackMuted, (_publication: TrackPublication, participant: Participant) => {
			refreshParticipantState(participant);
		});

		room.on(RoomEvent.TrackUnmuted, (_publication: TrackPublication, participant: Participant) => {
			refreshParticipantState(participant);
		});
	}

	private subscribeToParticipantDisconnected(room: Room) {
		room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
			this.participantService.removeRemoteParticipant(participant.sid);
		});
	}

	private subscribeToParticipantMetadataChanged(room: Room) {
		room.on(
			RoomEvent.ParticipantMetadataChanged,
			(metadata: string | undefined, participant: RemoteParticipant | LocalParticipant) => {
				this.log.d('ParticipantMetadataChanged', { metadata, participant });
			}
		);
		// 服务端改名（如主持人请求参会者改名后 setName）会更新 participant.name；
		// ParticipantModel 的 name getter 依赖 _revision，这里 bump 触发界面刷新。
		room.on(
			RoomEvent.ParticipantNameChanged,
			(name: string, participant: RemoteParticipant | LocalParticipant) => {
				this.log.d('ParticipantNameChanged', { name, identity: participant?.identity });
				if (participant?.isLocal) {
					this.participantService.updateLocalParticipant();
				} else if (participant) {
					this.participantService.addRemoteParticipant(participant as RemoteParticipant);
				}
			}
		);
	}

	private subscribeToDataMessage(room: Room) {
		room.on(
			RoomEvent.DataReceived,
			async (payload: Uint8Array, participant?: RemoteParticipant, _?: DataPacket_Kind, topic?: string) => {
				try {
					const decoder = new TextDecoder();
					const fromServer = participant === undefined;
					const storedParticipant = participant
						? this.participantService.getRemoteParticipantBySid(participant.sid || '')
						: undefined;
					if (participant && !storedParticipant) {
						this.log.w('DataReceived from unknown participant', participant);
						return;
					}
					if (!fromServer && !participant) {
						this.log.w('DataReceived from unknown source', payload);
						return;
					}

					const participantIdentity = storedParticipant?.identity || '';
					const participantName = storedParticipant?.name || '';
					const rawText = decoder.decode(payload);
					this.log.d('DataReceived (raw)', { topic });

					const eventMessage = safeJsonParse(rawText);
					if (!eventMessage) {
						this.log.w('Discarding data: malformed JSON', rawText);
						return;
					}

					this.log.d(`Data event received: ${topic}`);
					this.handleDataEvent(
						topic,
						eventMessage,
						participantName || participantIdentity || 'Unknown',
						participantIdentity
					);
				} catch (err) {
					this.log.e('Unhandled error processing DataReceived', err);
				}
			}
		);
	}

	private handleDataEvent(topic: string | undefined, event: unknown, participantName: string, participantIdentity = '') {
		if (!topic) return;

		switch (topic) {
			case DataTopic.CHAT: {
				const payload = event as MeetingChatSignalPayload;
				// 私聊消息经 destinationIdentities 定向投递，这里再做一层归属校验
				if (payload.to && payload.to !== this.participantService.getMyIdentity()) {
					break;
				}
				this.chatService.addRemoteMessage(payload.message, participantName, payload.attachment, {
					isPrivate: !!payload.to,
					fromIdentity: participantIdentity || payload.fromIdentity
				});
				break;
			}
			case MeetSignalType.MEET_RECORDING_UPDATED: {
				this.handleRecordingUpdated(event as MeetRecordingUpdatedPayload);
				break;
			}
			default:
				break;
		}
	}

	private handleRecordingUpdated(event: MeetRecordingUpdatedPayload): void {
		const { recording } = event;

		switch (recording.status) {
			case MeetRecordingStatus.STARTING:
				this.recordingService.setRecordingStarting(recording.recordingId);
				break;
			case MeetRecordingStatus.ACTIVE:
				this.recordingService.setRecordingStarted(recording.recordingId, recording.startDate ?? Date.now());
				break;
			case MeetRecordingStatus.ENDING:
				this.recordingService.setRecordingStopping();
				break;
			case MeetRecordingStatus.COMPLETE:
				this.recordingService.setRecordingStopped();
				break;
			case MeetRecordingStatus.FAILED:
			case MeetRecordingStatus.ABORTED:
			case MeetRecordingStatus.LIMIT_REACHED:
				this.recordingService.setRecordingFailed(recording.error ?? recording.details ?? 'Recording failed');
				break;
			default:
				break;
		}
	}

	private subscribeToReconnection(room: Room, callbacks: SessionRoomEventCallbacks) {
		room.on(RoomEvent.Reconnecting, () => {
			this.log.w('Connection lost: Reconnecting');
			this.actionService.openConnectionDialog(
				this.translateService.translate('ERRORS.CONNECTION'),
				this.translateService.translate('ERRORS.RECONNECT')
			);
			callbacks.onRoomReconnecting();
		});

		room.on(RoomEvent.Reconnected, () => {
			this.log.w('Connection lost: Reconnected');
			this.actionService.closeConnectionDialog();
			callbacks.onRoomReconnected();
		});

		room.on(RoomEvent.Disconnected, async (reason: DisconnectReason | undefined) => {
			this._activeSpeakers.set([]);
			this.actionService.closeConnectionDialog();
			const participantLeftEvent: ParticipantLeftEvent = {
				roomName: this.openviduService.getRoomName(),
				participantName: this.participantService.getMyName() || '',
				identity: this.participantService.getMyIdentity() || '',
				reason: ParticipantLeftReason.NETWORK_DISCONNECT
			};
			const messageErrorKey = 'ERRORS.DISCONNECT';
			let descriptionErrorKey = '';
			switch (reason) {
				case DisconnectReason.CLIENT_INITIATED:
					if (!this.openviduService.shouldHandleClientInitiatedDisconnectEvent) return;
					participantLeftEvent.reason = ParticipantLeftReason.LEAVE;
					break;
				case DisconnectReason.DUPLICATE_IDENTITY:
					participantLeftEvent.reason = ParticipantLeftReason.DUPLICATE_IDENTITY;
					descriptionErrorKey = 'ERRORS.DUPLICATE_IDENTITY';
					break;
				case DisconnectReason.SERVER_SHUTDOWN:
					descriptionErrorKey = 'ERRORS.SERVER_SHUTDOWN';
					participantLeftEvent.reason = ParticipantLeftReason.SERVER_SHUTDOWN;
					break;
				case DisconnectReason.PARTICIPANT_REMOVED:
					participantLeftEvent.reason = ParticipantLeftReason.PARTICIPANT_REMOVED;
					descriptionErrorKey = 'ERRORS.PARTICIPANT_REMOVED';
					break;
				case DisconnectReason.ROOM_DELETED:
					participantLeftEvent.reason = ParticipantLeftReason.ROOM_DELETED;
					descriptionErrorKey = 'ERRORS.ROOM_DELETED';
					break;
				case DisconnectReason.SIGNAL_CLOSE:
					participantLeftEvent.reason = ParticipantLeftReason.SIGNAL_CLOSE;
					descriptionErrorKey = 'ERRORS.SIGNAL_CLOSE';
					break;
				default:
					participantLeftEvent.reason = ParticipantLeftReason.OTHER;
					descriptionErrorKey = 'ERRORS.DISCONNECT';
					break;
			}

			this.log.d('Participant disconnected', participantLeftEvent);
			callbacks.onParticipantLeft(participantLeftEvent);
			if (this.libService.getShowDisconnectionDialog() && descriptionErrorKey) {
				this.actionService.openDialog(
					this.translateService.translate(messageErrorKey),
					this.translateService.translate(descriptionErrorKey)
				);
			}
		});
	}

	private subscribeToConnectionQualityChanged(room: Room) {
		room.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality, participant: Participant) => {
			const previousQuality = this.participantService.getConnectionQuality(participant.sid);
			if (previousQuality === quality) {
				return;
			}

			this.participantService.setConnectionQuality(participant.sid, quality);
		});
	}
}
