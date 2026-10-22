/**
 * Interface representing an API key in the Meet application.
 */
export interface MeetApiKey {
	/** Unique identifier for the API key */
	key: string;
	/** Timestamp in milliseconds since epoch when the API key was created */
	creationDate: number;
}
