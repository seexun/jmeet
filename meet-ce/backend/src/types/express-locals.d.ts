declare global {
	namespace Express {
		interface Locals {
			validatedQuery?: Record<string, unknown>;
			bulkValidation?: {
				processableIds: string[];
				failed: unknown[];
			};
		}
	}
}

export {};
