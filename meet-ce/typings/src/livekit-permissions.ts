export enum TrackSource {
	/**
	 * @generated from enum value: UNKNOWN = 0;
	 */
	UNKNOWN = 0,
	/**
	 * @generated from enum value: CAMERA = 1;
	 */
	CAMERA = 1,
	/**
	 * @generated from enum value: MICROPHONE = 2;
	 */
	MICROPHONE = 2,
	/**
	 * @generated from enum value: SCREEN_SHARE = 3;
	 */
	SCREEN_SHARE = 3,
	/**
	 * @generated from enum value: SCREEN_SHARE_AUDIO = 4;
	 */
	SCREEN_SHARE_AUDIO = 4
}

interface VideoGrant {
	/** permission to create a room */
	roomCreate?: boolean;
	/** permission to join a room as a participant, room must be set */
	roomJoin?: boolean;
	/** permission to list rooms */
	roomList?: boolean;
	/** permission to start a recording */
	roomRecord?: boolean;
	/** permission to control a specific room, room must be set */
	roomAdmin?: boolean;
	/** name of the room, must be set for admin or join permissions */
	room?: string;
	/** permissions to control ingress, not specific to any room or ingress */
	ingressAdmin?: boolean;
	/**
	 * allow participant to publish. If neither canPublish or canSubscribe is set,
	 * both publish and subscribe are enabled
	 */
	canPublish?: boolean;
	/**
	 * TrackSource types that the participant is allowed to publish
	 * When set, it supersedes CanPublish. Only sources explicitly set here can be published
	 */
	canPublishSources?: TrackSource[];
	/** allow participant to subscribe to other tracks */
	canSubscribe?: boolean;
	/**
	 * allow participants to publish data, defaults to true if not set
	 */
	canPublishData?: boolean;
	/**
	 * by default, a participant is not allowed to update its own metadata
	 */
	canUpdateOwnMetadata?: boolean;
	/** participant isn't visible to others */
	hidden?: boolean;
	/** participant is recording the room, when set, allows room to indicate it's being recorded */
	recorder?: boolean;
	/** participant allowed to connect to LiveKit as Agent Framework worker */
	agent?: boolean;
	/** allow participant to subscribe to metrics */
	canSubscribeMetrics?: boolean;
	/** destination room which this participant can forward to */
	destinationRoom?: string;
}

/**
 * Defines LiveKit-specific permissions for a participant.
 */
export type LiveKitPermissions = VideoGrant;
