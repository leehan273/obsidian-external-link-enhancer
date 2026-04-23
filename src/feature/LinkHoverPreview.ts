
import { Editor, MarkdownPostProcessorContext, HoverPopover, HoverParent, MarkdownPostProcessor } from 'obsidian';

import { EditorView } from "@codemirror/view";

/* eslint-disable no-console */


import { OpengraphLinkMetadata, OpengraphCodeblockGenerator, OpengraphCodeBlockProcessor } from "./OpenGraphLink";

import { checkHTTPLink } from "../utils"

import type { PageMetadata } from "../parse";
import ObsidianExternalLinkEnhancerPlugin from "../main";

export class LinkHoverPreviewFeature {
	// app: App;
	plugin: ObsidianExternalLinkEnhancerPlugin;

	public enableHoverPreview: boolean = true;

	// // TODO
	// public isCtrlKeyRequiredForEditingView: boolean = true;
	// public isCtrlKeyRequiredForReadingView: boolean = true;

	private requestCache: Map<string, PageMetadata> = new Map();

	constructor(plugin: ObsidianExternalLinkEnhancerPlugin) {
		this.plugin = plugin;
	}

	public register(): void {
		this.plugin.addCommand({
			id: "toggle-link-hover-preview-activation",
			name: "Toggle activation of link hover preview",

			editorCallback: async () => {
				this.enableHoverPreview = !(this.enableHoverPreview);
				await this.plugin.saveSettings();
			},
		});

		// For Editing View (Source mode / Live Preview)
		this.plugin.registerEditorExtension(this.buildEditorExtension());

		// For Reading View
		this.plugin.registerMarkdownPostProcessor(this.buildMarkdownPostProcessor());
	}

	/** Build CodeMirror Extension for Obsidian's Editing view */
	private buildEditorExtension() {

		const checkExternalHTTPLink: (element: HTMLElement, clickableToken: unknown) => { isExternalLink: false } | { isExternalLink: true, url: string } = (element: HTMLElement, clickableToken: unknown) => {

			// # Obsidian's Editor inspect result.
			// 
			// Tested in Live Preview / Source mode both.
			// 
			// - Text part In Preview
			// 	 `<span class="cm-underline" tabindex="-1" draggable="true">https://github.com/microsoft/vscode</span>`
			//   `<span class="cm-underline" tabindex="-1" draggable="true">title</span>`
			// - The 'external-link' icon element (https://lucide.dev/icons/external-link) after titled link. This serve ClickableToken
			//   `<span class="cm-formatting cm-formatting-link-string cm-string cm-url external-link" contenteditable="false"></span>`
			// 
			// - Text in Editing (If current mode is source mode, or currently editing paragraph in Live Preview)
			// 	 
			//   Link without any syntax code. raw url
			//   <span class="cm-url" spellcheck="false">https://github.com/microsoft/vscode</span>
			//   Link wrapper `< >`	 
			//   <span class="cm-formatting cm-formatting-link cm-link cm-url" spellcheck="false">https://github.com/microsoft/vscode</span>
			//   
			//   Title Part of `[title](url)`
			//   <span class="cm-link">vscode</span>
			//   Url Part of `[title](url)`
			// 	 <span class="cm-formatting cm-formatting-link cm-link cm-url" spellcheck="false">https://github.com/microsoft/vscode</span>

			const fastCheckWithSharedClass: boolean =
				element.classList.contains("cm-url") ||
				element.classList.contains("cm-underline") ||
				element.classList.contains("cm-link");

			if (fastCheckWithSharedClass === false) return { isExternalLink: false };


			// For getting 
			// 
			// IMPORTANT: Not all link provides clickableToken

			// - Titled link ():
			//   Provides clickableToken
			// 
			// - Raw link (`<link>` ):
			//   If that line has only raw link content, it works with clickableToken
			//   but if wrapped with `< >` or inside other text, it doesn't works as ClickableToken


			if (typeof clickableToken === "object" && clickableToken !== null) {
				// ClickableToken reference:
				// https://github.com/Fevol/obsidian-typings/blob/3.16.6/src/obsidian/internals/ClickableToken.d.ts#L8
				const token = clickableToken as Record<string, unknown>;

				let token_type: string | undefined = undefined;
				let token_text: string | undefined = undefined;

				if (typeof token.type === "string") token_type = token.type;
				if (typeof token.text === "string") token_text = token.text;

				// `type` could be "internal-link" if vault's note link (`[[note_filename]]`)
				if (token_type !== "external-link" || token_text === undefined) return { isExternalLink: false };

				if (checkHTTPLink(token_text)) return { isExternalLink: true, url: token_text };
			} else {
				const text = element.textContent ? element.textContent.trim() : "";

				if (checkHTTPLink(text)) return { isExternalLink: true, url: text };
			}

			return { isExternalLink: false };
		}

		const handler = (event: MouseEvent, editorView: EditorView) => {
			if ((event.target instanceof HTMLElement) === false) return;

			const { target } = event;

			const app = this.plugin.app;

			const editor: Editor = app.workspace.activeEditor!.editor!

			const pos = editorView.posAtDOM(target);
			const editorPos = editor.offsetToPos(pos);

			// getClickableTokenAt: https://fevol.github.io/obsidian-typings/api/obsidian-typings/namespaces/obsidian/classes/editor/#getclickabletokenat
			//
			// clickableToken: ClickableToken | null | undefined
			//
			// @ts-ignore
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const clickableToken: unknown = editor.getClickableTokenAt(editorPos);


			const checkResult = checkExternalHTTPLink(target, clickableToken);

			if (checkResult.isExternalLink === false) return false;

			const url = checkResult.url;

			void this.openLinkHoverPreview({ parent: this.plugin.app.workspace.activeEditor!, targetEl: target }, url);

			return true;
		}

		return EditorView.domEventHandlers({
			mouseover: (event: MouseEvent, editorView: EditorView) => {
				if (this.enableHoverPreview === false) {
					return;
				}

				// TODO: If press Ctrl key after pointer moved, preview doesn't appear. this should be fix
				if (event.ctrlKey === false) return;

				try {
					const result = handler(event, editorView);

					return result;
				} catch {
					return false;
				}
			},
			keydown: (event: KeyboardEvent, editorView: EditorView) => {
				// TODO: Ctrl key can be tracked with this
			},

		})
	}

	/** Build MarkdownPostProcessor for Obsidian's Reading view */
	private buildMarkdownPostProcessor(): MarkdownPostProcessor {

		return (paragraphEl: HTMLElement, ctx: MarkdownPostProcessorContext) => {

			const anchorElements = paragraphEl.querySelectorAll("a");

			anchorElements.forEach((anchorEl: HTMLAnchorElement) => {
				if (anchorEl.classList.contains("external-link") === false) return;

				const href = anchorEl.href.trim();

				if (checkHTTPLink(href) === false) return;

				anchorEl.addEventListener("mouseover", (event: MouseEvent) => {
					if (this.enableHoverPreview === false) {
						return;
					}

					void this.openLinkHoverPreview({ parent: this.plugin.app.workspace.activeEditor!, targetEl: anchorEl, waitTime: 300, }, href);
				});
			});
		};
	}

	public async openLinkHoverPreview(hoverProp: { parent: HoverParent, targetEl: HTMLElement, waitTime?: number, pos?: { x: number, y: number } }, url: string) {
		if (checkHTTPLink(url) === false) return;


		const preview = new LinkHoverPreviewPopover(hoverProp);

		preview.tooltip(url);

		const func = async () => {
			const pageMetadata = await this.requestPageMetadata(url);

			if (pageMetadata === null) return;

			const opengraphLinkMetadata = OpengraphCodeblockGenerator.pageMetadata2OpengraphLinkMetadata(pageMetadata);

			preview.opengraph(opengraphLinkMetadata);
		};

		void func();


		return false;
	}

	private async requestPageMetadata(url: string): Promise<PageMetadata | null> {
		const cacheResult = this.requestCache.get(url);

		if (cacheResult) {
			return cacheResult;
		}


		const pageMetadata = await this.plugin.getPageMetadata(url);

		if (pageMetadata !== null) {

			this.requestCache.set(url, pageMetadata);
			return pageMetadata;
		}

		return null;
	}
}


class LinkHoverPreviewPopover extends HoverPopover {
	containerEl: HTMLElement;

	constructor(hoverProp: { parent: HoverParent, targetEl: HTMLElement, waitTime?: number, pos?: { x: number, y: number } }) {
		const { parent, targetEl, waitTime, pos } = hoverProp;

		super(parent, targetEl, waitTime ? waitTime : 0, pos ? pos : null);

		this.containerEl = document.createElement("div");
		this.hoverEl.appendChild(this.containerEl);


		// In Editing View, this popover will disappear immediately when mouse cursor move out from link.
		// But in Reading View, mouse cursor can be move around in this popover and click the open graph link.
		//
		// When 
		// Except Open Graph link, there's no clickable element in this popover. so just add mousedown eventlistener
		this.hoverEl.addEventListener("mousedown", (e) => {
			// If unload immediately, obsidian can't handle link open event.
			setTimeout(() => {
				this.unload();
			}, 100);
		});

	}


	// Obsidian's default HoverPopover CSS: (`--popover-width` is 450px)
	// `.popover.hover-popover > * { width: var(--popover-width); }`
	//
	// `.popover.hover-popover` is `hoverEl`
	private ignoreDefaultPopoverWidth() {
		this.containerEl.setCssStyles({ width: "fit-content", maxWidth: "var(--popover-width)" });
	}
	private restoreDefaultPopoverWidth() {
		this.containerEl.setCssStyles({ width: "var(--popover-width)", maxWidth: "inherit" });
	}

	public tooltip(url: string) {
		this.ignoreDefaultPopoverWidth();

		const rawUrlTooltipContainerEL = document.createElement("div");
		rawUrlTooltipContainerEL.setCssStyles({ fontSize: "var(--font-smallest)", padding: "0.5em", lineBreak: "anywhere" });

		this.containerEl.appendChild(rawUrlTooltipContainerEL);

		const rawUrlEl = document.createElement("code");
		rawUrlEl.textContent = url;

		rawUrlTooltipContainerEL.appendChild(rawUrlEl);
	}

	public opengraph(data: OpengraphLinkMetadata) {
		this.restoreDefaultPopoverWidth();

		this.containerEl.appendChild(OpengraphCodeBlockProcessor.createOpengraphLinkElement(data))
	}


	override onunload(): void {
		this.hoverEl.remove();
	}
}
