# Obsidian External Link Enhancer

**Tested on Obsidian 1.12.7 (Linux)**

Work in progress.

## Setup and Usage Guide

- **Title Autocomplete**

	It works automatically with the default settings.
- **Open Graph link**

	I recommend primarily using one of the two methods.
	(Manually writing the `opengraph` content will not cause any functional issues, but it is not recommended.)
	
	- Clipboard Option
		Use the feature by copying the URL to the clipboard.
		You can use it via the `External Link Enhancer: Create Opengraph link from Clipboard URL` command or through the Context menu (right-click) in the Editor.
	- Modal Option
		You can use it via the `External Link Enhancer: `Create Open Graph link with modal` command.
	
	It is recommended to use the item in the Context menu, or assign one of the two commands to a suitable hotkey.

- **Link Hover Preview**

	It is enabled by default.
	
	- In Editing View (Live Preview / Editing mode), you can see a preview of the link by hovering your mouse over it while holding down Ctrl. For titled links, it can also be used to check the corresponding URL.
	- In Reading View (Reading mode), you simply need to hover your mouse over the link.

- Text only Open Graph link
	
	Markdown natively has a feature to embed externally hosted images, and
	as explained in [Obsidian Help](https://obsidian.md/help/embeds#Embed%20an%20image%20in%20a%20noteObsidian), you can also insert remote resource images in Obsidian using a format like `![image](https://obsidian.md/images/banner.png)`. In this case, a web request is made from the user's device to the `obsidian.md` site during the process of displaying the image.
	
	For the same reason, if an Open Graph link contains an image, a remote resource request occurs during the process of displaying it. (The `image` and `logo` properties are images.)

	If you want to prevent these requests from occurring, enable the `Open Graph Link > Render text only (exclude images)` option in the settings.
	
	Other features like Title autocomplete, Link Hover preview, and generating a new Open Graph link from a URL also inevitably generate web requests during the process of retrieving information. However, while these requests only occur when intentionally using the features, web requests generated during the process of rendering an Open Graph link can occur unintentionally when opening previously written note content, which is why this option exists separately.
	If you do not mind this, it is fine to leave it in its default state.
	
- Language

	If your primary language is not English, the page information displayed through Title Autocomplete, Open Graph Link, Hover Preview, etc., will be displayed in English, unlike your usual web browser (even though it is the URL of a page that would be displayed in your primary language in the browser).
	If you wish to change this, edit the `Advanced > Request Accept-Language header` value accordingly.

## Features

### Title Autocomplete

Automatically completes the title when pasting a URL.

### Open Graph link

Generates a rich link using the [Open Graph Protocol](https://en.wikipedia.org/wiki/Open_Graph_protocol).

Example:

```opengraph
url: https://obsidian.md/
title: "Obsidian - Sharpen your thinking"
description: "The free and flexible app for your private thoughts."
site: "Obsidian"
logo: https://obsidian.md/favicon.ico
image: https://obsidian.md/images/banner.png
```

### Link Hover Preview

Displays a preview of external links in Open Graph link format.

- Editing View: Ctrl + mouse hover
- Reading View: Mouse hover


## How to Install

Please use BRAT: [Quick guide for using BRAT](https://tfthacker.com/brat-quick-guide)

```text
https://github.com/leehan273/obsidian-external-link-enhancer
```

## Limitations

Due to how it works, the features will not function properly if a site has anti-scraping measures in place.

Well-known sites with anti-scraping measures include:

- X (Twitter)
- Reddit

The features may not work correctly on these sites.

