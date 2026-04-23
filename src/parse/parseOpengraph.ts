import * as cheerio from "cheerio";


import { ensureAbsoluteUrl } from "../utils";

interface OpenGraphImage {
	url: string;
	secureUrl?: string;
	type?: string;
	width?: number;
	height?: number;
	alt?: string;
}

interface OpenGraphData {
	title?: string;
	description?: string;
	type?: string;
	url?: string;
	locale?: string;
	siteName?: string;

	image?: OpenGraphImage[];

	// Reference: [Open Graph Logo spec](https://clearbit.com/blog/open-graph-logo)
	logo?: string;
}


function parseOpenGraph(html: string, baseUrl?: string): OpenGraphData {
	const $ = cheerio.load(html);
	const ogData: OpenGraphData = {};


	$('meta[property^="og:"], meta[name^="og:"]').each((_, element) => {
		const property = $(element).attr("property") || $(element).attr("name");
		const content = $(element).attr("content");

		if (!(property && content)) return;

		const key = property.replace("og:", "");
		const value = content.trim();

		switch (key) {
			case 'title':
				ogData.title = value;
				break;
			case 'description':
				ogData.description = value;
				break;
			case "url":
				ogData.url = value;
				break;
			case "type":
				ogData.type = value;
				break;
			case "site_name":
				ogData.siteName = value;
				break;
			case "locale":
				ogData.locale = value;
				break;
			case "logo":
				ogData.logo = ensureAbsoluteUrl(value, baseUrl);
				break;
		}
	});

	const images: OpenGraphImage[] = [];

	$('meta[property^="og:image"]').each((_, el) => {
		const property = $(el).attr('property')!;
		const content = $(el).attr('content')!;

		let image = images.find(img => img.url === ensureAbsoluteUrl(content, baseUrl));

		if (!image) {
			image = { url: ensureAbsoluteUrl(content, baseUrl), };
			images.push(image);
		}

		switch (property) {
			case 'og:image:secure_url':
				image.secureUrl = ensureAbsoluteUrl(content, baseUrl);
				break;
			case 'og:image:width':
				image.width = parseInt(content, 10);
				break;
			case 'og:image:height':
				image.height = parseInt(content, 10);
				break;
			case 'og:image:type':
				image.type = content;
				break;
			case 'og:image:alt':
				image.alt = content;
				break;
		}
	});

	ogData.image = images;

	return ogData;
}


export { parseOpenGraph };

export type { OpenGraphData, OpenGraphImage }
