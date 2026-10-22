export const setsAreEqual = <T>(setA: Set<T>, setB: Set<T>): boolean => {
	if (setA.size !== setB.size) return false;
	for (const item of setA) {
		if (!setB.has(item)) return false;
	}
	return true;
};

export const arraysAreEqual = <T>(arrayA: T[], arrayB: T[]): boolean => {
	if (arrayA.length !== arrayB.length) return false;
	for (let i = 0; i < arrayA.length; i++) {
		if (arrayA[i] !== arrayB[i]) return false;
	}
	return true;
};
