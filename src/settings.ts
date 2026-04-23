import { App, PluginSettingTab, Setting } from "obsidian";

import ObsidianExternalLinkEnhancerPlugin from "./main";
const DEFAULT_ACCEPT_LANGUAGE = "en-US,en;q=0.9";

export interface ObsidianExternalLinkEnhancerPluginSettings {
	request_header: {
		accept_language: string,
	},

	title_autocomplete: {
		trigger_on_editor_paste: boolean,
		trigger_on_editor_drop: boolean,
	},

	opengraph_link: {
		show_clipboard_option_on_editor_menu: boolean,
		insert_markdown_link_for_compatibility: "none" | "comment" | "uncomment",
		should_text_only_render: boolean,
	},

	link_hover_preview: {
		enable_hover_preview: boolean,
	},
}




export const DEFAULT_SETTINGS: ObsidianExternalLinkEnhancerPluginSettings = {
	request_header: {
		accept_language: DEFAULT_ACCEPT_LANGUAGE,
	},

	title_autocomplete: {
		trigger_on_editor_paste: true,
		trigger_on_editor_drop: true,
	},

	opengraph_link: {
		show_clipboard_option_on_editor_menu: true,
		insert_markdown_link_for_compatibility: "none",
		should_text_only_render: false,
	},

	link_hover_preview: {
		enable_hover_preview: true,
	},
}

export class ExternalLinkEnhancerPluginSettingTab extends PluginSettingTab {
	plugin: ObsidianExternalLinkEnhancerPlugin;

	constructor(app: App, plugin: ObsidianExternalLinkEnhancerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		{

			// eslint-disable-next-line obsidianmd/ui/sentence-case
			new Setting(containerEl).setName("Title Autocomplete").setDesc("Automatically fills in the title to URL").setHeading()

			new Setting(containerEl)
				.setName("On paste")
				.setDesc("If the clipboard text is a URL, auto-complete the title.")
				.addToggle(toggle =>
					toggle
						.setValue(this.plugin.settings.title_autocomplete.trigger_on_editor_paste)
						.onChange(async (value) => {
							this.plugin.settings.title_autocomplete.trigger_on_editor_paste = value;
							await this.plugin.saveSettings();
						})
				)

			new Setting(containerEl)
				.setName("On drag and drop")
				.setDesc("If a URL is dragged and dropped, auto-complete the title.")
				.addToggle(toggle =>
					toggle
						.setValue(this.plugin.settings.title_autocomplete.trigger_on_editor_drop)
						.onChange(async (value) => {
							this.plugin.settings.title_autocomplete.trigger_on_editor_drop = value;
							await this.plugin.saveSettings();
						})
				)
		}

		{
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			new Setting(containerEl).setName("Open Graph Link").setDesc("Insert Open Graph links (rich links) in notes. Use the `opengraph` codeblock.").setHeading()

			new Setting(containerEl)
				.setName("Add a create from clipboard option to the editor context menu")
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc("Show \"Create Opengraph link from Clipboard URL\" in the editor context menu.")
				.addToggle(toggle =>
					toggle
						.setValue(this.plugin.settings.opengraph_link.show_clipboard_option_on_editor_menu)
						.onChange(async (value) => {
							this.plugin.settings.opengraph_link.show_clipboard_option_on_editor_menu = value;
							await this.plugin.saveSettings();
						})
				)

			// // TODO: todo
			// new Setting(containerEl)
			// 	.setName("Insert a Markdown link for compatibility")
			// 	.setDesc(ExternalLinkEnhancerPluginSettingTab.convertDocumentFragment([
			// 		"Automatically insert `[title](url)` when creating an Open Graph link.",
			// 		"<p> </p>",
			// 		"\
			// 		<ul>\
			// 			<li><b>Off</b>: Do not insert a Markdown link automatically. </li>\
			// 			<li><b>Comment</b>: Insert as an <a href='https://obsidian.md/help/syntax#Comments'>Obsidian Comments</a> <code>%%[title](url)%%</code></li>\
			// 			<li><b>Normal</b>: Insert as a Markdown link. </li>\
			// 		</ul>\
			// 		"
			// 	]))
			// 	.addDropdown(dropdown =>
			// 		dropdown
			// 			.addOption("off", "Off")
			// 			.addOption("comment", "Comment")
			// 			.addOption("uncomment", "Normal")
			// 			.setValue("off")
			// 			.onChange(async (value) => {
			// 				// @ts-ignore
			// 				this.plugin.settings.opengraph_link.insert_markdown_link_for_compatibility = value;

			// 				await this.plugin.saveSettings();
			// 			})
			// 	)

			new Setting(containerEl)
				.setName("Render text only (exclude images)")
				.setDesc("This prevents unintended remote image requests while simply viewing notes.")
				.addToggle(toggle =>
					toggle
						.setValue(this.plugin.settings.opengraph_link.should_text_only_render)
						.onChange(async (value) => {
							this.plugin.settings.opengraph_link.should_text_only_render = value;
							await this.plugin.saveSettings();
						})
				)

		}


		{

			// eslint-disable-next-line obsidianmd/ui/sentence-case
			new Setting(containerEl).setName("Hover Preview").setHeading()


			new Setting(containerEl)
				.setName("Enable hover preview")
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc("Display an Open Graph preview when hovering over a link.")
				.addToggle(toggle =>
					toggle
						.setValue(this.plugin.settings.link_hover_preview.enable_hover_preview)
						.onChange(async (value) => {
							this.plugin.settings.link_hover_preview.enable_hover_preview = value;
							await this.plugin.saveSettings();
						})
				)

		}

		{

			new Setting(containerEl)
				.setName("Advanced")
				.setDesc("You may not need to modify this. Leave it blank to restore the default value.")
				.setHeading();



			// new Setting(containerEl)
			//     .setName('')
			//     .setDesc('[USER AGENT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent)')
			//     .setDesc(ExternalLinkEnhancerPluginSettingTab.convertDocumentFragment([
			//         `MDN reference: <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-Language">User-Agent header</a>`
			//     ]))
			//     .addText(text =>
			//         text
			//             .setPlaceholder(DEFAULT_SETTINGS.request_header.user_agent)
			//             .setValue(this.plugin.settings.request_header.user_agent)
			//             .onChange(async (value) => {
			//                 if (value.trim().length == 0) {
			//                     this.plugin.settings.request_header.user_agent = DEFAULT_USER_AGENT;
			//                 } else {
			//                     this.plugin.settings.request_header.user_agent = value;
			//                 }
			//                 await this.plugin.saveSettings();
			//             }));

			new Setting(containerEl)
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setName("Request Accept-Language header")
				.setDesc(ExternalLinkEnhancerPluginSettingTab.convertDocumentFragment([
					`MDN reference: <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-Language">Accept-Language header</a>`
				]))
				.addText(text =>
					text
						.setPlaceholder(DEFAULT_SETTINGS.request_header.accept_language)
						.setValue(this.plugin.settings.request_header.accept_language)
						.onChange(async (value) => {
							if (value.trim().length == 0) {
								this.plugin.settings.request_header.accept_language = DEFAULT_ACCEPT_LANGUAGE;
							} else {
								this.plugin.settings.request_header.accept_language = value;
							}
							await this.plugin.saveSettings();
						}))
		}

	}

	private static convertDocumentFragment(content: string[]): DocumentFragment {
		const fragment = new DocumentFragment;

		content.forEach((line) => {
			const element = document.createElement("div");

			// eslint-disable-next-line @microsoft/sdl/no-inner-html
			element.innerHTML = line;

			fragment.appendChild(element);
		});

		return fragment;
	}
}
