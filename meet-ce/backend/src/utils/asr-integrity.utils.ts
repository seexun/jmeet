export interface AsrIntegrityResult {
	missingSequences: number[];
	contiguousSequence: number;
}

export function calculateAsrIntegrity(lastSequence: number, receivedSequences: Iterable<number>): AsrIntegrityResult {
	const received = new Set(receivedSequences);
	const missingSequences: number[] = [];
	for (let sequence = 1; sequence <= lastSequence; sequence++) {
		if (!received.has(sequence)) missingSequences.push(sequence);
	}
	return {
		missingSequences,
		contiguousSequence: missingSequences[0] ? missingSequences[0] - 1 : lastSequence
	};
}
