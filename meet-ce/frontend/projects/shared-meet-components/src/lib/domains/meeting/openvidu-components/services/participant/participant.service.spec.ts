import { ParticipantKind } from 'livekit-client';
import { shouldHideParticipant } from './participant.service';

describe('shouldHideParticipant', () => {
	it('hides LiveKit agent-kind participants (ASR caption agent)', () => {
		expect(shouldHideParticipant({ kind: ParticipantKind.AGENT })).toBe(true);
	});

	it('keeps standard human participants', () => {
		expect(shouldHideParticipant({ kind: ParticipantKind.STANDARD })).toBe(false);
	});

	it('keeps SIP participants (phone callers are real attendees)', () => {
		expect(shouldHideParticipant({ kind: ParticipantKind.SIP })).toBe(false);
	});

	it('keeps undefined kind (older SDK objects)', () => {
		expect(shouldHideParticipant({})).toBe(false);
	});
});
