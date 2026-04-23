
import { EditorView } from "@codemirror/view";
import { Editor, EditorPosition, MarkdownFileInfo, MarkdownView, Menu, Notice } from "obsidian";

import ObsidianExternalLinkEnhancerPlugin from "../main";
import { checkHTTPLink, generateHash } from "../utils";
import { PageMetadata } from "../parse";

export class TitleAutocompleteFeature {
	plugin: ObsidianExternalLinkEnhancerPlugin;

	private isShiftKeyPressed = false;

	public triggerOnEditorPaste: boolean = false;
	public triggerOnEditorDrop: boolean = false;

	constructor(plugin: ObsidianExternalLinkEnhancerPlugin) {
		this.plugin = plugin;
	}

	public register(): void {
		this.plugin.addCommand({
			id: "paste-url-and-title-autocomplete",
			name: "Paste URL and autocomplete title",
			editorCallback: this.onPasteUrlAndAutocompleteCommand.bind(this),
		});

		this.plugin.registerEvent(
			this.plugin.app.workspace.on(
				"editor-menu",
				(menu: Menu, editor: Editor, _info: MarkdownView | MarkdownFileInfo) => {
					try {
						const rawUrl = TitleAutocompleteFeature.checkCurrentCursorOnRawURL(editor);

						if (rawUrl === null) return;

						const url = new URL(rawUrl.url)

						menu.addItem((item) => {
							item
								.setTitle(`Autocomplete title "${url.host}..."`)
								.setIcon("link")
								.onClick(() => {
									void this.autocompleteExistUrl(editor, rawUrl);
								});
						});
					} catch (error) {
						console.error(error);
					}
				},
			),
		);

		this.plugin.registerEvent(this.plugin.app.workspace.on("editor-paste", this.onEditorPaste.bind(this)));
		this.plugin.registerEvent(this.plugin.app.workspace.on("editor-drop", this.onEditorDrop.bind(this)));

		this.plugin.registerEditorExtension(
			EditorView.domEventHandlers({
				keydown: (event: KeyboardEvent) => {
					this.isShiftKeyPressed = event.shiftKey;
					return false;
				},
			}),
		);
	}


	private async onPasteUrlAndAutocompleteCommand(editor: Editor, _info: MarkdownView | MarkdownFileInfo): Promise<void> {
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

		const url = TitleAutocompleteFeature.extractHttpUrl(clipboardText);

		if (url === null) {
			new Notice("Clipboard content is not a URL");
			return;
		}

		void this.autocompleteWithInsertNewUrl(editor, url);
	}

	private onEditorPaste(evt: ClipboardEvent, editor: Editor, _: MarkdownView | MarkdownFileInfo): void {
		if (this.triggerOnEditorPaste === false) return;

		if (evt.defaultPrevented) return;

		// Ctrl + Shift + V: keep Obsidian's plain-text paste behavior.
		if (this.isShiftKeyPressed) return;

		// If text is selected, keep Obsidian's default behavior. (make selected text as title)
		if (editor.getSelection()) return;

		const url = TitleAutocompleteFeature.extractHttpUrl(evt.clipboardData?.getData("text/plain"));

		if (url === null) return;

		evt.preventDefault();

		void this.autocompleteWithInsertNewUrl(editor, url);
	}

	private onEditorDrop(evt: DragEvent, editor: Editor, _: MarkdownView | MarkdownFileInfo): void {
		if (this.triggerOnEditorDrop === false) return;

		if (evt.defaultPrevented) return;

		const url = TitleAutocompleteFeature.extractHttpUrl(evt.dataTransfer?.getData("text/plain"));

		if (url === null) return;

		evt.preventDefault();

		void this.autocompleteWithInsertNewUrl(editor, url);
	}



	private static checkCurrentCursorOnRawURL(editor: Editor): null | { start: EditorPosition, end: EditorPosition, url: string } {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);

		const RAW_LINK_REGEX = /https?:\/\/[^\s<>"'`)\]}]+/g;

		const urlOnCursor: null | { start: number, end: number } = (() => {
			for (const match of line.matchAll(RAW_LINK_REGEX)) {
				const url = match[0];

				const startIndex = match.index ?? 0;
				const endIndex = startIndex + url.length;

				if (cursor.ch >= startIndex && cursor.ch <= endIndex) {
					return { start: startIndex, end: endIndex };
				}
			}
			return null;
		})();

		if (urlOnCursor === null) return null;

		const prevCharacter = urlOnCursor.start === 0 ? " " : line[urlOnCursor.start - 1];
		const nextCharacter = line.length > urlOnCursor.end ? line[urlOnCursor.end] : " ";

		// The purpose of this function is to determine if a URL is a plain URL without a title.
		// If it's enclosed in `()`, there's a very high probability that it's a URL with a title already provided.
		if (prevCharacter === "(" && nextCharacter === ")") return null;

		const result = {
			url: line.slice(urlOnCursor.start, urlOnCursor.end),
			start: { line: cursor.line, ch: urlOnCursor.start },
			end: { line: cursor.line, ch: urlOnCursor.end },
		}

		return result;
	}

	private async autocompleteWithInsertNewUrl(editor: Editor, url: string): Promise<void> {
		try {
			await TitleAutocompleteProcessor.autocompleteWithInsertNewUrl(editor, url, (url) => this.plugin.getPageMetadata(url));
		} catch (error) {
			new Notice(String(error));
			console.error(error);
		}
	}

	private async autocompleteExistUrl(editor: Editor, urlOnCursor: { start: EditorPosition, end: EditorPosition, url: string }): Promise<void> {
		try {
			await TitleAutocompleteProcessor.autocompleteExistUrl(editor, urlOnCursor, (url) => this.plugin.getPageMetadata(url));
		} catch (error) {
			new Notice(String(error));
			console.error(error);
		}
	}

	private static extractHttpUrl(text?: string): string | null {
		if (text === undefined) return null;

		const trimmed = text.trim();

		if (!trimmed) return null;
		if (!checkHTTPLink(trimmed)) return null;

		return trimmed;
	}
}

class TitleAutocompleteProcessor {
	public static async autocompleteWithInsertNewUrl(editor: Editor, url: string, getPageMetadata: (url: string) => Promise<PageMetadata | null>) {
		const hash = generateHash(`${url}-${Math.random()}`);

		const placeholder = `[#${hash}](${url})`;

		editor.replaceRange(placeholder, editor.getCursor());
		editor.setCursor({
			line: editor.getCursor().line,
			ch: editor.getCursor().ch + placeholder.length
		});

		try {
			const metadata = await getPageMetadata(url);
			const title = this.getTitleFromPageMetadata(metadata);

			const placeholderPosition = this.findTextInEditor(editor, placeholder);

			if (placeholderPosition === null) {
				throw new Error(`Cannot found ${placeholder} in content`);
			}

			const autocompleted = `[${title}](${url})`;

			editor.replaceRange(autocompleted, placeholderPosition.start, placeholderPosition.end);
		} catch (error) {
			const placeholderPosition = this.findTextInEditor(editor, placeholder);

			if (placeholderPosition === null) {
				new Notice(`Cannot found ${placeholder} in content`);
			} else {
				const rollbackContent = `${url}`;
				editor.replaceRange(rollbackContent, placeholderPosition.start, placeholderPosition.end);
			}
			console.error(error);
		}
	}

	public static async autocompleteExistUrl(editor: Editor, urlOnCursor: { start: EditorPosition, end: EditorPosition, url: string }, getPageMetadata: (url: string) => Promise<PageMetadata | null>) {

		const { url } = urlOnCursor;


		const hash = generateHash(`${url}-${Math.random()}`);

		const placeholder = `[#${hash}](${url})`;

		editor.replaceRange(placeholder, urlOnCursor.start, urlOnCursor.end);


		try {
			const metadata = await getPageMetadata(url);
			const title = this.getTitleFromPageMetadata(metadata);

			const placeholderPosition = this.findTextInEditor(editor, placeholder);

			if (placeholderPosition === null) {
				throw new Error(`Cannot found ${placeholder} in content`);
			}

			const autocompleted = `[${title}](${url})`;

			editor.replaceRange(autocompleted, placeholderPosition.start, placeholderPosition.end);
		} catch (error) {
			const placeholderPosition = this.findTextInEditor(editor, placeholder);

			if (placeholderPosition === null) {
				new Notice(`Cannot found ${placeholder} in content`);
			} else {
				const rollbackContent = `${url}`;
				editor.replaceRange(rollbackContent, placeholderPosition.start, placeholderPosition.end);
			}
			console.error(error);
		}
	}

	private static getTitleFromPageMetadata(metadata: PageMetadata | null): string {
		const basicTitle = metadata?.basic?.title?.trim();
		if (basicTitle) return basicTitle;

		const openGraphTitle = metadata?.opengraph?.title?.trim();
		if (openGraphTitle) return openGraphTitle;

		throw new Error("Cannot extract title from PageMetadata")
	}

	private static findTextInEditor(
		editor: Editor,
		target: string,
	): { start: EditorPosition; end: EditorPosition } | null {
		const content = editor.getValue();
		const startIndex = content.indexOf(target);

		if (startIndex === -1) return null;

		const endIndex = startIndex + target.length;

		return {
			start: this.indexToEditorPosition(content, startIndex),
			end: this.indexToEditorPosition(content, endIndex),
		};
	}

	private static indexToEditorPosition(
		content: string,
		index: number,
	): EditorPosition {
		const prev = content.slice(0, index);
		const lines = prev.split("\n");

		const targetLineIndex = lines.length - 1;
		const targetLineLengthBeforeTarget = lines[targetLineIndex]!.length;

		return { line: targetLineIndex, ch: targetLineLengthBeforeTarget };
	}
}
