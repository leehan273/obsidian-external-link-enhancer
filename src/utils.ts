
import * as crypto from 'crypto';

function ensureAbsoluteUrl(relativeUrl: string, baseUrl?: string): string {
	if (!relativeUrl) return '';
	if (relativeUrl.startsWith('http')) return relativeUrl;
	if (!baseUrl) return relativeUrl;

	try {
		return new URL(relativeUrl, baseUrl).toString();
	} catch {
		return relativeUrl;
	}
}

function generateHash(text: string, length: number = 5): string {
	return crypto
		.createHash('md5')
		.update(text + Date.now())
		.digest('hex')
		.slice(0, length);
}

function checkHTTPLink(text: string): boolean {
	/// https://developer.mozilla.org/en-US/docs/Web/API/URL/protocol
	const HTTP_OR_HTTPS = ["http:", "https:"];

	try {
		const url = new URL(text.trim());
		return HTTP_OR_HTTPS.includes(url.protocol);
	} catch {
		return false;
	}
}

export { ensureAbsoluteUrl, generateHash, checkHTTPLink };
