import chalk from 'chalk';
import fs from 'fs';
import { MEET_ENV } from '../environment.js';

let cachedHtml: string | null = null;
const cachedOpenApiHtml = new Map<string, string>();
let configValidated = false;

/**
 * Normalizes the base path to ensure it starts and ends with /
 * @param basePath The base path to normalize
 * @returns Normalized base path (e.g., '/', '/meet/', '/app/path/')
 */
export function normalizeBasePath(basePath: string): string {
	let normalized = basePath.trim();

	// Handle empty string
	if (!normalized) {
		return '/';
	}

	// Ensure it starts with /
	if (!normalized.startsWith('/')) {
		normalized = '/' + normalized;
	}

	// Ensure it ends with /
	if (!normalized.endsWith('/')) {
		normalized = normalized + '/';
	}

	return normalized;
}

/**
 * Validates the BASE_URL and BASE_PATH configuration and warns about potential issues.
 * Only runs once per process.
 */
function validateBasePathConfig(): void {
	if (configValidated) return;

	configValidated = true;

	const baseUrl = MEET_ENV.BASE_URL;
	const basePath = MEET_ENV.BASE_PATH;

	if (baseUrl) {
		try {
			const url = new URL(baseUrl);

			// Check if BASE_URL contains a path (other than just /)
			if (url.pathname && url.pathname !== '/') {
				console.warn(
					chalk.yellow('⚠️  WARNING: MEET_BASE_URL contains a path segment:'),
					chalk.cyan(url.pathname)
				);
				console.warn(
					chalk.yellow(
						'   MEET_BASE_URL should only contain https protocol and host (e.g., https://example.com)'
					)
				);
				console.warn(chalk.yellow('   Use MEET_BASE_PATH for the deployment path (e.g., /meet/)'));

				if (basePath && basePath !== '/') {
					console.warn(
						chalk.red(`   This may cause issues: BASE_URL path "${url.pathname}" + BASE_PATH "${basePath}"`)
					);
				}
			}
		} catch {
			console.warn(chalk.yellow('⚠️  WARNING: MEET_BASE_URL is not a valid URL:'), chalk.cyan(baseUrl));
		}
	}
}

/**
 * Gets the configured base path, normalized
 * @returns The normalized base path from MEET_BASE_PATH environment variable
 */
export function getBasePath(): string {
	validateBasePathConfig();
	return normalizeBasePath(MEET_ENV.BASE_PATH);
}

/**
 * Applies runtime base path configuration to the index.html
 * - Replaces the <base href="/"> tag with the configured base path
 * - Adds a script with window.__OPENVIDU_MEET_CONFIG__ for frontend access
 *
 * @param htmlPath Path to the index.html file
 * @returns The modified HTML content
 */
export function getHtmlWithBasePath(htmlPath: string): string {
	// In production, cache the result for performance
	if (process.env.NODE_ENV === 'production' && cachedHtml) {
		return cachedHtml;
	}

	const basePath = getBasePath();
	let html = fs.readFileSync(htmlPath, 'utf-8');

	// Replace the base href - handle both possible formats
	html = html.replace(/<base href="[^"]*"\s*\/?>/i, `<base href="${basePath}">`);

	// Inject runtime configuration script before the closing </head> tag
	const configScript = `<script>window.__OPENVIDU_MEET_CONFIG__={basePath:"${basePath}"};</script>`;
	html = html.replace('</head>', `${configScript}\n</head>`);

	if (process.env.NODE_ENV === 'production') {
		cachedHtml = html;
	}

	return html;
}

/**
 * Applies the runtime base path to the OpenAPI documentation HTML.
 * Replaces the servers URL in the embedded OpenAPI spec so that "Try It" requests
 * use the correct path when deployed under a base path (e.g. /meet/api/v1).
 *
 * @param htmlPath Path to the OpenAPI HTML file
 * @param apiBasePath The API base path (e.g. /api/v1 or /internal-api/v1)
 * @returns The modified HTML content
 */
export function getOpenApiHtmlWithBasePath(
	htmlPath: string,
	apiBasePath: string,
	docsLocale?: 'zh' | 'en'
): string {
	if (process.env.NODE_ENV === 'production' && cachedOpenApiHtml.has(htmlPath)) {
		return cachedOpenApiHtml.get(htmlPath)!;
	}

	const basePath = getBasePath();
	// Build full server URL: strip trailing slash from basePath to avoid double slashes
	const fullServerUrl = basePath.replace(/\/$/, '') + apiBasePath;

	let html = fs.readFileSync(htmlPath, 'utf-8');

	// Replace the servers URL in the embedded OpenAPI JSON
	// Matches "servers":[{"url":"<any-url>" and replaces the URL with the full path
	html = html.replace(
		/("servers":\[\{"url":")[^"]*(")/,
		`$1${fullServerUrl}$2`
	);

	if (docsLocale) {
		const docsBaseUrl = `${basePath.replace(/\/$/, '')}${apiBasePath}/docs`;
		const languageNavigation = `
<nav class="ov-api-language-switcher" aria-label="${docsLocale === 'zh' ? '文档语言' : 'Documentation language'}">
	<span>${docsLocale === 'zh' ? '文档语言' : 'Language'}</span>
	<a href="${docsBaseUrl}/zh/" lang="zh-CN"${docsLocale === 'zh' ? ' aria-current="page"' : ''}>中文</a>
	<a href="${docsBaseUrl}/en/" lang="en"${docsLocale === 'en' ? ' aria-current="page"' : ''}>English</a>
</nav>
<style>
	.ov-api-language-switcher{position:fixed;z-index:2147483647;top:12px;right:20px;display:flex;align-items:center;gap:4px;min-height:44px;padding:4px 6px 4px 14px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;color:#64748b;box-shadow:0 8px 24px rgb(15 23 42 / 6%);font:500 13px/1.4 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
	.ov-api-language-switcher a{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border-radius:7px;color:#0f172a;text-decoration:none;font-weight:600}
	.ov-api-language-switcher a:hover{background:#f2f3ff;color:#0052d9}
	.ov-api-language-switcher a:focus-visible{outline:2px solid #0052d9;outline-offset:2px}
	.ov-api-language-switcher a[aria-current="page"]{background:#0052d9;color:#fff}
	@media(max-width:640px){.ov-api-language-switcher{top:8px;right:8px}.ov-api-language-switcher>span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}}
</style>${
			docsLocale === 'zh'
				? `<script>
	const translations=new Map([['Overview','概览'],['ENDPOINTS','接口'],['Endpoints','接口'],['API Base URL','API 基础地址'],['Additional Information','其他信息'],['Contact OpenVidu','联系 OpenVidu'],['Terms of Service','服务条款'],['Export','导出'],['Try It','在线调试'],['Send','发送请求'],['Request','请求'],['Response','响应'],['Responses','响应'],['Parameters','参数'],['Headers','请求头'],['Body','请求体'],['Example','示例'],['Schema','数据结构'],['Security','身份认证'],['No parameters','无参数'],['Download','下载'],['Copy','复制'],['Copied','已复制']]);
	const translate=()=>{const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){const value=node.nodeValue?.trim();if(value&&translations.has(value))node.nodeValue=node.nodeValue.replace(value,translations.get(value));}};
	new MutationObserver(translate).observe(document.body,{childList:true,subtree:true});translate();
</script>`
				: ''
		}`;
		html = html.replace('</body>', `${languageNavigation}\n</body>`);
	}

	if (process.env.NODE_ENV === 'production') {
		cachedOpenApiHtml.set(htmlPath, html);
	}

	return html;
}

/**
 * Clears the cached HTML (useful for testing or config changes)
 */
export function clearHtmlCache(): void {
	cachedHtml = null;
	cachedOpenApiHtml.clear();
}
