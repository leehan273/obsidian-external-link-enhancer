import { App, Editor, MarkdownView, MarkdownFileInfo, MarkdownPostProcessorContext, Modal, Notice, Menu, Component, MarkdownRenderer, TextComponent, ButtonComponent, TextAreaComponent, EditorPosition } from 'obsidian';

/* eslint-disable no-console */

import { checkHTTPLink, generateHash } from "../utils"

import type { PageMetadata } from "../parse";

import { parseYaml } from "obsidian"

import ObsidianExternalLinkEnhancerPlugin from "../main";

export interface OpengraphLinkMetadata {
	url: string;
	title: string;
	description?: string;
	site?: string;
	logo?: string;
	image?: string;
}

export class OpenGraphLinkFeature {
	plugin: ObsidianExternalLinkEnhancerPlugin;

	public showClipboardOptionOnEditorMenu: boolean = false;
	public insertMarkdownLinkForCompatibility: "none" | "comment" | "uncomment" = "none";
	public shouldTextOnlyRender: boolean = true;

	constructor(plugin: ObsidianExternalLinkEnhancerPlugin) {
		this.plugin = plugin;
	}

	public register() {

		this.plugin.addCommand({
			id: "create-open-graph-link-with-modal",
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			name: "Create Open Graph link with modal",
			editorCallback: this.openOpengraphLinkCardInsertModal.bind(this),
		});
		this.plugin.addCommand({
			id: "create-open-graph-link-with-clipboard-url",
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			name: "Create Opengraph link from Clipboard URL",
			editorCallback: this.createOpenGraphLinkWithClipboard.bind(this),
		});


		this.plugin.registerEvent(
			this.plugin.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
				if (this.showClipboardOptionOnEditorMenu) {
					menu.addItem((item) => {
						item
							// eslint-disable-next-line obsidianmd/ui/sentence-case
							.setTitle("Create Opengraph link from Clipboard URL")
							.setIcon("clipboard")
							.onClick(async () => {
								await this.createOpenGraphLinkWithClipboard(editor, info);
							});
					});
				}
			})
		);


		this.plugin.registerMarkdownCodeBlockProcessor("opengraph", (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {

			return OpengraphCodeBlockProcessor.handler(source, el, ctx, this.shouldTextOnlyRender);
		});
	}

	async createOpenGraphLinkWithClipboard(editor: Editor, ctx: MarkdownView | MarkdownFileInfo): Promise<void> {
		let clipboardText: string;

		try {
			clipboardText = await navigator.clipboard.readText();
		} catch {
			new Notice("Failed to read text from clipboard");
			return;
		}

		if (clipboardText.length === 0) {
			new Notice("Clipboard content is not a text");
			return;
		}

		if (checkHTTPLink(clipboardText) === false) {
			new Notice("Clipboard content is not a URL");
			return;
		}

		void this.createOpengraphLinkCard(editor, clipboardText.trim());
	}

	async openOpengraphLinkCardInsertModal(editor: Editor, ctx: MarkdownView | MarkdownFileInfo): Promise<void> {
		const requestFunc = async (url: string) => {
			let pageMetadata = await this.plugin.getPageMetadata(url);

			if (pageMetadata === null) return null;

			const opengraphLinkMetadata = OpengraphCodeblockGenerator.pageMetadata2OpengraphLinkMetadata(pageMetadata);

			return opengraphLinkMetadata;
		}

		const insertFunc = (opengraphCodeblockContent: string) => {

			OpenGraphLinkFeature.ensureCurrentLineIsEmpty(editor);

			// this.getCompatibilityMarkdownLink()

			// Write on cursor and move cursor to new line
			editor.replaceRange(opengraphCodeblockContent + "\n", editor.getCursor());
			editor.setCursor({ line: editor.getCursor().line + opengraphCodeblockContent.split("\n").length, ch: 0 });
		}

		const modal = new OpenGraphLinkFormModal(this.plugin.app, requestFunc, insertFunc);

		modal.open();
	}

	public async createOpengraphLinkCard(editor: Editor, url: string) {

		const HASH_LENGTH = 5;
		const hash = generateHash(url, HASH_LENGTH);


		OpenGraphLinkFeature.ensureCurrentLineIsEmpty(editor);

		const loadingPlaceholderContent: string = OpengraphCodeblockGenerator.createLoadingPlaceholderContent(url, hash);

		// Write on cursor and move cursor to new line
		editor.replaceRange(loadingPlaceholderContent + "\n", editor.getCursor());
		editor.setCursor({ line: editor.getCursor().line + loadingPlaceholderContent.split("\n").length, ch: 0 });


		let pageMetadata: PageMetadata | null = null;

		try {
			pageMetadata = await this.plugin.getPageMetadata(url);

		} catch (error) {
			new Notice(`Failed to get page metadata about ${url}`)
			console.error(error);

			// Need to find now because the user can editing note content while fetch page
			const placeholderPosition = OpenGraphLinkFeature.findContentInEditor(editor, loadingPlaceholderContent);
			editor.replaceRange("", placeholderPosition.start, placeholderPosition.end);
		}

		if (pageMetadata === null) return;

		// After parse metadata

		try {
			const placeholderPosition = OpenGraphLinkFeature.findContentInEditor(editor, loadingPlaceholderContent);

			const opengraphLinkMetadata = OpengraphCodeblockGenerator.pageMetadata2OpengraphLinkMetadata(pageMetadata);
			const opengraphLinkContent = OpengraphCodeblockGenerator.createOpengraphLinkContent(opengraphLinkMetadata);

			editor.replaceRange(opengraphLinkContent, placeholderPosition.start, placeholderPosition.end);
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {

				new Notice(`${error}`);
			}

		}
	}

	public getCompatibilityMarkdownLink(url: string, title: string): string | null {
		if (this.insertMarkdownLinkForCompatibility === "none") return null;

		if (this.insertMarkdownLinkForCompatibility === "comment") {
			return `%% [${title}](${url}) %%`;
		} else {
			return `[${title}](${url})`;
		}
	}

	static ensureCurrentLineIsEmpty(editor: Editor) {
		const currentCursorPosition: EditorPosition = editor.getCursor();
		const currentLine: string = editor.getLine(currentCursorPosition.line);

		// Do nothing on empty line
		if (currentLine.length === 0) return;

		// Just clear line if only whitespace
		if (currentLine.trim().length === 0) {
			editor.setLine(currentCursorPosition.line, "");
			return;
		}

		// If current line is not empty, create new empty line
		editor.setCursor({ line: currentCursorPosition.line + 1, ch: 0 });
		editor.replaceRange(
			"\n",
			{ line: currentCursorPosition.line + 1, ch: 0 },
			{ line: currentCursorPosition.line + 1, ch: 0 }
		);
	}
	static findContentInEditor(editor: Editor, target: string): { start: EditorPosition, end: EditorPosition } {
		const editorContent = editor.getValue();

		if (editorContent.includes(target) === false) throw new Error(`Can't Find "${target}" in Editor Content`);

		const targetIndexOfContent = {
			start: editorContent.indexOf(target),
			end: editorContent.indexOf(target) + target.length
		};

		const convertIndexToEditorPosition = (context: string, index: number): EditorPosition => {
			const prev = context.slice(0, index);
			const lines = prev.split('\n');

			const targetLineIndex = lines.length - 1;
			const targetLineLengthBeforeTarget = lines[targetLineIndex]!.length;

			return { line: targetLineIndex, ch: targetLineLengthBeforeTarget };
		}


		const result: { start: EditorPosition, end: EditorPosition } = {
			start: convertIndexToEditorPosition(editorContent, targetIndexOfContent.start),
			end: convertIndexToEditorPosition(editorContent, targetIndexOfContent.end),
		};

		return result;
	}
}

class OpenGraphLinkFormModal extends Modal {
	requestCallback: (url: string) => Promise<OpengraphLinkMetadata | null>
	submitCallback: (data: string) => void

	content: string;

	fetching: boolean;

	constructor(app: App, requestCallback: (url: string) => Promise<OpengraphLinkMetadata | null>, submitCallback: (data: string) => void) {
		super(app);

		this.requestCallback = requestCallback;
		this.submitCallback = submitCallback;

		this.content = "";

		this.fetching = false;
	}

	override async onOpen() {
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		this.setTitle("Insert Open Graph Link");

		const {
			urlInputComponent,
			parseButtonComponent,
			editTextAreaComponent,
			previewAreaContainerEl,
			insertButtonComponent
		} = this.prepareForm(this.contentEl)

		const updatePreview = async (content: string) => {
			const codeblockContent = `\`\`\`opengraph\n${content}\n\`\`\``;

			previewAreaContainerEl.setCssStyles({ display: "block" });
			previewAreaContainerEl.innerHTML = "";

			const dummyComp = new Component();

			await MarkdownRenderer.render(this.app, codeblockContent, previewAreaContainerEl, "/", dummyComp);
		}

		editTextAreaComponent.onChange(async (content: string) => {
			this.content = content;

			void updatePreview(this.content);
		});

		const parseCurrentUrl = async () => {
			if (this.fetching) return;
			if (checkHTTPLink(urlInputComponent.getValue().trim()) === false) return;

			this.fetching = true;
			parseButtonComponent.setDisabled(true);
			const opengraphLinkMetadata = await this.requestCallback(urlInputComponent.getValue().trim());
			parseButtonComponent.setDisabled(false);
			this.fetching = false;

			if (opengraphLinkMetadata === null) {
				new Notice("Parsing error");
				return;
			};

			let codeblockContent: string = OpengraphCodeblockGenerator.createOpengraphLinkContent(opengraphLinkMetadata);

			const newData = codeblockContent.replace("```opengraph", "").replace("```", "");

			editTextAreaComponent.setDisabled(false);
			editTextAreaComponent.setValue(newData);
			this.content = editTextAreaComponent.getValue();

			void updatePreview(editTextAreaComponent.getValue());

			insertButtonComponent.buttonEl.setCssStyles({ display: "block" });
			insertButtonComponent.setDisabled(false);

			editTextAreaComponent.inputEl.focus();
		}

		parseButtonComponent.onClick(() => parseCurrentUrl());
		insertButtonComponent.onClick(() => this.insert());

		urlInputComponent.inputEl.addEventListener('keydown', (evt: KeyboardEvent) => {
			if (evt.key === "Enter") {
				void parseCurrentUrl();
			}
		});

		editTextAreaComponent.inputEl.addEventListener('keydown', (evt: KeyboardEvent) => {
			if (evt.key === "Enter" && evt.ctrlKey === true) {
				this.insert();
			}
		});


		const clipboardText = await navigator.clipboard.readText();

		if (checkHTTPLink(clipboardText.trim())) {
			urlInputComponent.setValue(clipboardText.trim());
		}
	}

	private insert() {
		const result = `\`\`\`opengraph\n${this.content.trim()}\n\`\`\``;

		void this.submitCallback(result);
		this.close();
	}

	// override onClose() {
	// 	const { contentEl } = this;
	// 	contentEl.empty();
	// }

	private prepareForm(contentEl: HTMLElement): {
		urlInputComponent: TextComponent,
		parseButtonComponent: ButtonComponent,
		editTextAreaComponent: TextAreaComponent,
		previewAreaContainerEl: HTMLElement,
		insertButtonComponent: ButtonComponent,
	} {
		const headerContainerEl = document.createElement("div");

		headerContainerEl.setCssStyles({ display: "flex" });

		const urlInputComponent = new TextComponent(headerContainerEl);

		urlInputComponent.inputEl.setCssStyles({ width: "-webkit-fill-available" });
		urlInputComponent.setPlaceholder("https://example.com");

		const parseButtonComponent = new ButtonComponent(headerContainerEl);

		parseButtonComponent.buttonEl.setCssStyles({ marginLeft: "0.5rem" })
		parseButtonComponent.setButtonText("Parse");

		contentEl.appendChild(headerContainerEl);


		const editAreaContainerEl = document.createElement("div");
		editAreaContainerEl.setCssStyles({ marginTop: "1rem" })

		contentEl.appendChild(editAreaContainerEl);

		const editTextAreaComponent = new TextAreaComponent(editAreaContainerEl);

		editTextAreaComponent.setDisabled(true);
		editTextAreaComponent.inputEl.setCssStyles({ resize: "none", width: "100%", height: "10lh" });
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		editTextAreaComponent.setPlaceholder(`url:\ntitle:\ndescription:\nsite:\nlogo:\nimage:\n`);

		const previewAreaContainerEl = document.createElement("div");
		previewAreaContainerEl.setCssStyles({ display: "none", marginTop: "0.5rem", overflowX: "hidden" })

		contentEl.appendChild(previewAreaContainerEl);

		const footerContainerEl = document.createElement("div");
		footerContainerEl.setCssStyles({ marginTop: "1rem" })

		contentEl.appendChild(footerContainerEl);

		const insertButtonComponent = new ButtonComponent(footerContainerEl)
		insertButtonComponent.setButtonText("Insert");
		insertButtonComponent.setDisabled(true);
		insertButtonComponent.buttonEl.setCssStyles({ width: "-webkit-fill-available" });

		return { urlInputComponent, parseButtonComponent, editTextAreaComponent, previewAreaContainerEl, insertButtonComponent };
	}
}

export class OpengraphCodeblockGenerator {

	public static createLoadingPlaceholderContent(url: string, hash: string): string {

		const lines: string[] = [];

		// Example: "```opengraph-load-912ec8"
		lines.push("```opengraph-load" + "-" + hash);
		lines.push(url);
		lines.push("```");

		return lines.join("\n");
	}

	public static createOpengraphLinkContent(data: OpengraphLinkMetadata): string {

		const lines: string[] = [];

		lines.push("```opengraph");
		lines.push(`url: ${data.url}`);
		lines.push(`title: ${OpengraphCodeblockGenerator.escapeYamlString(data.title)}`);

		if (data.description) {
			lines.push(`description: ${OpengraphCodeblockGenerator.escapeYamlString(data.description)}`);
		}
		if (data.site) {
			lines.push(`site: ${OpengraphCodeblockGenerator.escapeYamlString(data.site)}`);
		}
		if (data.logo) {
			lines.push(`logo: ${data.logo}`);
		}

		if (data.image) {
			lines.push(`image: ${data.image}`);
		}

		lines.push("```");

		return lines.join("\n");
	}

	private static escapeYamlString(str: string): string {
		if (/[\n"':#{}[\],&*?|<>=!%@`]/.test(str)) {
			return `"${str
				.replace(/"/g, '\\"')
				.replace(/\n/g, '\\n')}"`;
		} else {
			return `"${str}"`;
		}
	}

	public static pageMetadata2OpengraphLinkMetadata(pageMetaData: PageMetadata): OpengraphLinkMetadata {
		const { url: originalUrl, basic, opengraph } = pageMetaData;

		const temp: { [k: string]: string | undefined } = {};

		const getFirstImageUrl = (images: unknown): string | undefined => {
			try {
				// @ts-ignore
				// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
				return images[0].url;
			} catch {
				// console.error(err);
				return undefined;
			}
		}

		temp.url = opengraph?.url ?? basic?.canonicalUrl;
		temp.title = opengraph?.title ?? basic?.title;
		temp.description = opengraph?.description ?? basic?.description;
		temp.site = opengraph?.siteName;
		temp.logo = opengraph?.logo ?? basic?.favicon;
		temp.image = getFirstImageUrl(opengraph?.image) ?? getFirstImageUrl(basic?.images);

		const result: OpengraphLinkMetadata = {
			url: temp.url ?? originalUrl, // url is required,
			title: temp.title ?? (temp.url ?? originalUrl), // Title is required, but can't assume. so just set url
			description: temp.description,
			site: temp.site ?? new URL(originalUrl).hostname,
			logo: temp.logo,
			image: temp.image,
		};

		return result;
	}
}

export class OpengraphCodeBlockProcessor {

	public static handler(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext, textMode?: boolean): void {
		try {
			const data = OpengraphCodeBlockProcessor.parseOpengraphLinkMetadata(source);

			if (textMode) {
				data.logo = undefined;
				data.image = undefined;
			}

			const opengraphLinkCardElement = OpengraphCodeBlockProcessor.createOpengraphLinkElement(data);

			el.appendChild(opengraphLinkCardElement);
		} catch (error: unknown) {
			if (error instanceof Error) {
				el.appendChild(OpengraphCodeBlockProcessor.createErrorElement(error));
			} else {
				console.log("OpengraphCodeBlockProcessor handler exception")
				console.log(error);
			}
		}
	}

	private static parseOpengraphLinkMetadata(source: string): OpengraphLinkMetadata {
		const raw: unknown = parseYaml(source);

		if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
			throw new Error("Should be YAML data");
		}

		const record = raw as Record<string, unknown>;

		if (typeof record.url !== "string" || typeof record.title !== "string") {
			throw new Error("`url` and `title` must be strings");
		}

		const opengraphLinkMetadata: OpengraphLinkMetadata = {
			url: record.url,
			title: record.title,
		}

		if (typeof record.description === "string" || typeof record.description === "number") {
			opengraphLinkMetadata.description = String(record.description)
		}
		if (typeof record.site === "string" || typeof record.site === "number") {
			opengraphLinkMetadata.site = String(record.site)
		}

		if (typeof record.image === "string") opengraphLinkMetadata.image = record.image;
		if (typeof record.logo === "string") opengraphLinkMetadata.logo = record.logo;

		return opengraphLinkMetadata;
	}

	public static createOpengraphLinkElement(metadata: OpengraphLinkMetadata): HTMLElement {
		const PREFIX: string = "opengraph-link";


		const render_container_el = document.createElement("div");
		render_container_el.classList.add(PREFIX, "render-container");

		const link_card_el = document.createElement("a");
		link_card_el.classList.add(PREFIX, "link-card");
		link_card_el.setAttr("href", metadata.url);

		render_container_el.appendChild(link_card_el);

		const main_content_container_el = document.createElement("div");
		main_content_container_el.classList.add(PREFIX, "main-content-container");
		link_card_el.appendChild(main_content_container_el);
		{
			const text_content_container_el = document.createElement("div");
			main_content_container_el.appendChild(text_content_container_el);

			{
				const title_el = document.createElement("p");
				title_el.classList.add(PREFIX, "title");
				title_el.textContent = metadata.title;
				text_content_container_el.appendChild(title_el);

				if (metadata.description) {
					const description_el = document.createElement("p");
					description_el.classList.add(PREFIX, "description");
					description_el.textContent = metadata.description;
					text_content_container_el.appendChild(description_el);
				}
			}

			const site_content_container_el = document.createElement("div");
			site_content_container_el.classList.add(PREFIX, "site-content-container");
			main_content_container_el.appendChild(site_content_container_el);
			{
				if (metadata.logo) {
					const logo_el = document.createElement("img");
					logo_el.classList.add(PREFIX, "logo");
					logo_el.setAttr("src", metadata.logo);
					site_content_container_el.appendChild(logo_el);
				}

				if (metadata.site) {
					const site_el = document.createElement("div");
					site_el.classList.add(PREFIX, "site");
					site_el.textContent = metadata.site;
					site_content_container_el.appendChild(site_el);
				}
			}
		}

		if (metadata.image) {
			const image_container_el = document.createElement("div");
			image_container_el.classList.add(PREFIX, "image-container");
			link_card_el.appendChild(image_container_el);

			const image_el = document.createElement("img");
			image_el.classList.add(PREFIX, "image");
			image_el.setAttr("src", metadata.image);
			image_el.setAttr("draggable", "false");

			image_container_el.appendChild(image_el);
		}

		return render_container_el;
	}


	private static createErrorElement(error: Error): HTMLElement {
		const PREFIX: string = "opengraph-card";

		const render_container_el = document.createElement("div");
		render_container_el.classList.add(PREFIX, "render-container");


		const title_el = document.createElement("div");
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		title_el.textContent = "Open Graph link render error";
		title_el.setCssStyles({ fontWeight: "bold", marginLeft: "1em" })

		const desc_el = document.createElement("div");
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		desc_el.textContent = "Check the content is YAML syntax and Open Graph link property";
		desc_el.setCssStyles({ fontWeight: "", marginLeft: "1em" })

		const error_name_el = document.createElement("pre");
		error_name_el.textContent = error.name;
		error_name_el.setCssStyles({ fontWeight: "bold", fontSize: "var(--font-smaller)", marginLeft: "1em" });

		const error_message_el = document.createElement("pre");
		error_message_el.textContent = error.message;
		error_message_el.setCssStyles({ fontSize: "var(--font-smaller)", marginLeft: "1em" });

		render_container_el.appendChild(title_el);
		render_container_el.appendChild(desc_el);
		render_container_el.appendChild(error_name_el);
		render_container_el.appendChild(error_message_el);

		const edit_button_highlighter = document.createElement("div");
		edit_button_highlighter.setCssStyles("")

		return render_container_el;
	}
}
