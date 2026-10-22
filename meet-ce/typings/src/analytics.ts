/**
 * Interface representing analytics data for JMeet usage.
 */
export interface MeetAnalytics {
	/**
	 * Total number of rooms created
	 */
	totalRooms: number;
	/**
	 * Number of rooms currently with an active meeting
	 */
	activeRooms: number;
	/**
	 * Total number of recordings created
	 */
	totalRecordings: number;
	/**
	 * Number of recordings that are complete and playable
	 */
	completeRecordings: number;
}
