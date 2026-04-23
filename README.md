# Obsidian External Link Enhancer

**Tested on Obsidian 1.12.7 (Linux)**

Work in progress.

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


## Limitations

Due to how it works, the features will not function properly if a site has anti-scraping measures in place.

Well-known sites with anti-scraping measures include:

- X (Twitter)
- Reddit

The features may not work correctly on these sites.
