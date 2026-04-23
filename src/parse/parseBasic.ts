import * as cheerio from "cheerio";
import { ensureAbsoluteUrl } from "../utils";

interface BasicMetadata {
	title?: string;
	description?: string;
	language?: string;
	author?: string;
	favicon?: string;
	images?: { url: string; alt: string; }[];
	canonicalUrl?: string;
	lastModified?: string;
}

function parseBasic(html: string, baseUrl?: string): BasicMetadata {
	const $ = cheerio.load(html);
	const mainContent = getMainContent($);

	const basicData: BasicMetadata = {};

	try {
		basicData.title =
			$('meta[name="title"]').attr('content')?.trim() ||
			$('title').text().trim() ||
			$('h1').first().text().trim() ||
			extractText($, 'h2', 100);
	} catch (err) {
		console.error("Error while parsing Basic title:", err);
		basicData.title = undefined;
	}

	try {
		basicData.description =
			$('meta[name="description"]').attr('content')?.trim() ||
			extractText($, mainContent.find('p').first().length ? mainContent.find('p').first() : 'p', 200) ||
			extractText($, 'p', 200);
	} catch (err) {
		console.error("Error while parsing Basic description:", err);
		basicData.description = undefined;
	}

	try {
		const favicon =
			$('link[rel="icon"]').attr('href') ||
			$('link[rel="shortcut icon"]').attr('href');
		if (favicon) {
			basicData.favicon = ensureAbsoluteUrl(favicon, baseUrl);
		}
	} catch (err) {
		console.error("Error while parsing Basic favicon:", err);
		basicData.favicon = undefined;
	}

	try {
		const canonical = $('link[rel="canonical"]').attr('href');
		if (canonical) {
			basicData.canonicalUrl = ensureAbsoluteUrl(canonical, baseUrl);
		}
	} catch (err) {
		console.error("Error while parsing Basic canonicalUrl:", err);
		basicData.canonicalUrl = undefined;
	}

	try {
		const lastModified = $('meta[property="article:modified_time"]').attr('content') ||
			$('time[datetime]').attr('datetime');
		basicData.lastModified = lastModified;
	} catch (err) {
		console.error("Error while parsing Basic lastModified:", err);
		basicData.lastModified = undefined;
	}

	try {
		basicData.images = extractImages($, baseUrl);
	} catch (err) {
		console.error("Error while parsing Basic images:", err);
		basicData.images = undefined;
	}

	return basicData;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMainContent($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
	const contentSelectors = [
		'article',
		'main',
		'[role="main"]',
		'#content',
		'.content',
		'.post-content',
		'.article-content',
		'.entry-content',
		'#main-content',
		'.main-content',
		'.post',
		'.article'
	];

	for (const selector of contentSelectors) {
		const element = $(selector);
		if (element.length > 0) {
			return element.first();
		}
	}

	return $('body');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText($: cheerio.CheerioAPI, selector: string | cheerio.Cheerio<any>, maxLength = 200): string {
	const element = typeof selector === 'string' ? $(selector) : selector;
	const text = element.first().text().trim().replace(/\s+/g, ' ');

	if (text.length <= maxLength) {
		return text;
	}

	return text.slice(0, maxLength) + '...';
}

function extractImages($: cheerio.CheerioAPI, baseUrl?: string): { url: string; alt: string; }[] {
	const images: { url: string; alt: string; }[] = [];

	$('img').each((_, img) => {
		const src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy-src');
		const alt = $(img).attr('alt');
		const width = parseInt($(img).attr('width') || '0', 10);
		const height = parseInt($(img).attr('height') || '0', 10);

		if (src &&
			!src.startsWith('data:') &&
			!src.toLowerCase().includes('avatar') &&
			!src.toLowerCase().includes('logo') &&
			(width > 100 || height > 100)) {
			images.push({ url: ensureAbsoluteUrl(src, baseUrl), alt: alt || '' });
		}
	});

	return images;
}

export {
	parseBasic,
};

export type { BasicMetadata };
