export type MeetPollType = 'single' | 'multiple' | 'rating';
export type MeetPollStatus = 'draft' | 'active' | 'closed';
export interface MeetPollOption { optionId: string; text: string }
export interface MeetPollResult { optionId: string; text: string; count: number; percentage: number }
export interface MeetPoll {
	pollId: string; roomId: string; meetingSessionId?: string; question: string; type: MeetPollType;
	options: MeetPollOption[]; anonymous: boolean; allowChange: boolean; showResults: boolean;
	status: MeetPollStatus; createdBy: string; createdAt: number; updatedAt: number; publishedAt?: number; closedAt?: number;
	responseCount: number; eligibleCount: number; participationRate: number; results?: MeetPollResult[]; myAnswer?: string[];
}
export interface MeetPollCreateRequest { question: string; type: MeetPollType; options?: string[]; anonymous: boolean; allowChange: boolean; showResults: boolean }
export interface MeetPollAnswerRequest { optionIds: string[] }
