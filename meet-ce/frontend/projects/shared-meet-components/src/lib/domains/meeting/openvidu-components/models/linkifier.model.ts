import linkifyStr from 'linkify-string';

/**
 * Thin wrapper around the `linkify-string` package for chat messages.
 *
 * Chat messages are plain text typed into a `<textarea>` and rendered via
 * `[innerHTML]`. `linkify-string` treats its input as plain text and HTML-escapes
 * it (escaping `<`, `>`, `&`, and `"` inside attribute values) before injecting
 * anchor tags, so link injection stays XSS-safe regardless of Angular's own
 * sanitizer. linkifyjs is TLD-aware, so it detects absolute URLs, `www.`/bare
 * domains (e.g. `demos.openvidu.io`) and email addresses while leaving ordinary
 * text such as "file.txt" untouched.
 *
 * @internal
 */
const LINKIFY_OPTS = {
	// Bare domains and `www.` links get `https://` rather than the http:// default.
	defaultProtocol: 'https',
	target: '_blank',
	rel: 'noopener noreferrer'
};

/**
 * @internal
 */
export class Linkifier {
	public link(text: string): string {
		return text ? linkifyStr(text, LINKIFY_OPTS) : text;
	}
}
