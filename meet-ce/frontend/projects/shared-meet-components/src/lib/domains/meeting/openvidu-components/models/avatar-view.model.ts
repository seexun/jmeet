/**
 * View-only descriptor for the avatar poster rendered behind a video element.
 *
 * Groups the avatar-related inputs of the video element so the component stays
 * decoupled from the participant/stream domain model: both the in-call stream
 * view and the pre-join preview build a plain literal of this shape. Mirrors the
 * inputs of `ParticipantAvatarComponent`.
 */
export interface AvatarView {
	/** Whether the avatar poster is shown (camera off or no video track). */
	show: boolean;
	/** Display name rendered on the avatar. */
	name: string;
	/** Avatar background color. */
	color: string;
	/** Whether the speaking indicator is active. */
	isSpeaking: boolean;
	/** Whether to surface the media-encryption error state. */
	hasEncryptionError: boolean;
}

/** Default avatar view: hidden poster with neutral placeholders. */
export const DEFAULT_AVATAR_VIEW: AvatarView = {
	show: false,
	name: 'User',
	color: '#000000',
	isSpeaking: false,
	hasEncryptionError: false
};
