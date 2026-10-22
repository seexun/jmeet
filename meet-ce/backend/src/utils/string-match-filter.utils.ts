import { TextMatchMode } from '@openvidu-meet/typings';

export type StringMatchCondition = string | RegExp | { $gte: string; $lt: string };

/**
 * Builds a Mongo-compatible filter condition for string matching.
 */
export const buildStringMatchFilter = (
	value: string,
	matchMode: TextMatchMode = TextMatchMode.EXACT,
	caseInsensitive = false
): StringMatchCondition => {
	switch (matchMode) {
		case TextMatchMode.EXACT:
			return caseInsensitive ? new RegExp(`^${escapeRegexLiteral(value)}$`, 'i') : value;

		case TextMatchMode.PREFIX:
			if (caseInsensitive) {
				return new RegExp(`^${escapeRegexLiteral(value)}`, 'i');
			}

			return {
				$gte: value,
				$lt: `${value}\uffff`
			};

		case TextMatchMode.PARTIAL:
			return new RegExp(escapeRegexLiteral(value), caseInsensitive ? 'i' : '');

		case TextMatchMode.REGEX:
			return new RegExp(value, caseInsensitive ? 'i' : '');
	}
};

/**
 * Escapes regex metacharacters so a user-provided value is interpreted literally.
 */
const escapeRegexLiteral = (value: string): string => {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
