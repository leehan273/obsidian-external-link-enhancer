import { Plugin, requestUrl } from 'obsidian';
import { DEFAULT_SETTINGS, ExternalLinkEnhancerPluginSettingTab, ObsidianExternalLinkEnhancerPluginSettings } from "./settings";

import { parse } from "./parse"
import type { PageMetadata } from "./parse";

import { LinkHoverPreviewFeature } from './feature/LinkHoverPreview';
import { OpenGraphLinkFeature } from "./feature/OpenGraphLink"
import { TitleAutocompleteFeature } from "./feature/TitleAutocomplete"

export default class ObsidianExternalLinkEnhancerPlugin extends Plugin {
	settings!: ObsidianExternalLinkEnhancerPluginSettings;

	openGraphLinkFeature!: OpenGraphLinkFeature;
	titleAutocompleteFeature!: TitleAutocompleteFeature;
	linkHoverPreviewFeature!: LinkHoverPreviewFeature;


	override async onload() {
		this.openGraphLinkFeature = new OpenGraphLinkFeature(this);
		this.openGraphLinkFeature.register();

		this.linkHoverPreviewFeature = new LinkHoverPreviewFeature(this);
		this.linkHoverPreviewFeature.register();

		this.titleAutocompleteFeature = new TitleAutocompleteFeature(this);
		this.titleAutocompleteFeature.register();


		await this.loadSettings();

		this.addSettingTab(new ExternalLinkEnhancerPluginSettingTab(this.app, this));
	}

	onunload() { }

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ObsidianExternalLinkEnhancerPluginSettings>);

		this.syncSettingsToFeature();
	}

	async saveSettings() {
		await this.saveData(this.settings);

		this.syncSettingsToFeature();
	}

	private syncSettingsToFeature() {
		if (this.titleAutocompleteFeature) {
			this.titleAutocompleteFeature.triggerOnEditorPaste = this.settings.title_autocomplete.trigger_on_editor_paste;
			this.titleAutocompleteFeature.triggerOnEditorDrop = this.settings.title_autocomplete.trigger_on_editor_drop;
		}

		if (this.openGraphLinkFeature) {
			this.openGraphLinkFeature.showClipboardOptionOnEditorMenu = this.settings.opengraph_link.show_clipboard_option_on_editor_menu;
			this.openGraphLinkFeature.insertMarkdownLinkForCompatibility = this.settings.opengraph_link.insert_markdown_link_for_compatibility;
			this.openGraphLinkFeature.shouldTextOnlyRender = this.settings.opengraph_link.should_text_only_render;
		}

		if (this.linkHoverPreviewFeature) {
			this.linkHoverPreviewFeature.enableHoverPreview = this.settings.link_hover_preview.enable_hover_preview;
		}
	}

	async getPageMetadata(url: string): Promise<PageMetadata | null> {
		const fetchResult = await this.fetchPage(
			url,
			this.settings.request_header.accept_language
		);

		if (fetchResult.success === false) {
			console.error("Failed to fetch page:", fetchResult.error);

			return null;
		}

		const pageMetadata = parse(url, fetchResult.data);

		return pageMetadata;
	}

	private async fetchPage(
		url: string,
		accept_language?: string,
	): Promise<{ success: true; headers: Record<string, string>; status: number; data: string } | { success: false; error: Error }> {
		const requestHeaders: Record<string, string> = {};

		// if (user_agent !== undefined) requestHeaders["User-Agent"] = user_agent;
		if (accept_language !== undefined) requestHeaders["Accept-Language"] = accept_language;

		try {
			const response = await requestUrl({ url, headers: requestHeaders });

			const contentType = response.headers["content-type"]?.toLowerCase() ?? "";

			if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
				return {
					success: false,
					error: new Error(`Response is not HTML: ${contentType || "unknown"}`),
				};
			}

			if (response.status < 200 || response.status >= 300) {
				return {
					success: false,
					error: new Error(`HTTP ${response.status}: Request failed for ${url}`),
				};
			}

			return {
				success: true,
				headers: response.headers,
				status: response.status,
				data: new TextDecoder("utf-8").decode(response.arrayBuffer),
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error : new Error(String(error)),
			};
		}
	}

}

