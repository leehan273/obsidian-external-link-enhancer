
import { parseBasic } from "./parseBasic";
import { parseOpenGraph } from "./parseOpengraph";

import type { BasicMetadata } from "./parseBasic";
import type { OpenGraphData } from "./parseOpengraph";

interface PageMetadata {
	url: string;
	basic?: BasicMetadata;
	opengraph?: OpenGraphData;
}

function parse(originalUrl: string, html: string): PageMetadata {

	const pageMetadata: PageMetadata = { url: originalUrl };

	try {
		pageMetadata.opengraph = parseOpenGraph(html, originalUrl);
	} catch (err) {
		console.error(err);
	}

	try {
		pageMetadata.basic = parseBasic(html, originalUrl);
	} catch (err) {
		console.error(err);
	}

	return pageMetadata;
}

export { parse };

export type { PageMetadata };
