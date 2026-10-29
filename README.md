# 鲸译 · Whale Mode

A selection translator for the DeepSeek Harness Web UI.

Select text in the conversation, pick **翻译** on the floating toolbar, and the translation opens in a deep-sea card. The result contains only the translation; the original line breaks and blank lines are preserved.

## What it does

- **Selection first, translation second.** A toolbar appears above the selected text. Translation starts only after **翻译** is clicked. The translate action uses the same quiet button treatment as the other actions; no action is rendered as a bright primary block.
- **Automatic direction.** Chinese selections go to English; English (and other Latin-script) selections go to Chinese. The target language can be changed in the card.
- **Line breaks are structural.** Translation requests keep the newline skeleton and are verified after the provider responds. If a provider collapses or adds a line break, the plugin falls back to a one-line-per-line pass, then restores each line's original leading/trailing whitespace.
- **Only the translation.** The result panel does not print the source text or a "Translation:" prefix.
- **The rest of the toolbar:** copy, read aloud with the browser speech engine, a local extractive summary, search in a new Bing tab, and a small more menu.
- **Whale mode.** A custom line-art whale, deep-ocean navy, bioluminescent cyan, and a wave-glass card. The toolbar stays dark in both themes; the card follows the host theme.

## Scope: where the toolbar can appear

This package is a **Harness client plugin**, not a browser extension. Its code is loaded only into the DSH Web UI page at the app origin, so it cannot attach to other browser tabs, other origins, or a website opened outside DSH. A web page cannot run script in another origin; selecting text on an external page therefore cannot trigger this toolbar no matter how the selection is made.

For external pages there is a companion **browser extension** in [`extension/`](extension/README.md): load that folder unpacked in Edge/Chrome, and it injects the same whale toolbar into any `http(s)` page, including `contenteditable` editors.

Inside the DSH page, the toolbar appears for a non-empty selection made with the mouse, touch, or keyboard. It deliberately ignores `input`, `textarea`, `select`, `contenteditable`, `pre`, and `code` regions so it never interrupts typing, editing, or code copying. Selections inside a cross-origin iframe are outside this document and are not seen.

Closing the toolbar (X, Escape, "关闭工具栏", scroll, or a click elsewhere) suppresses the same selection until the next interaction, so the card does not immediately pop back.

## How it works

The browser half lives in `client.js` and registers into `shell.overlay`. It listens for `mouseup`, `touchend`, `selectionchange` (debounced), and Shift+keyup, excludes editable fields and code blocks, and anchors the toolbar to the selection's viewport rect. A selection that is dismissed once stays dismissed until the next interaction.

The host half lives in `index.js` and registers one same-origin route:

```
POST /api/dsh/whale-translator/translate
{ "text": "...", "source": "auto", "target": "auto" }
```

- Microsoft Edge's translator endpoint is tried first; HTTP 429/5xx is retried once.
- If it is unreachable, the card returns a fast error and a retry button instead of waiting on a slow third-party fallback.
- Responses are bounded to 12,000 selected characters, request bodies to 96 KiB, and the route accepts `application/json` same-origin POSTs only. Oversized bodies get a `413` instead of a torn socket.
- Successful translations are cached in memory for the process lifetime; the cache is bounded by entry count and by total characters.

## Privacy

The selected text leaves the machine only after **翻译** is clicked. The translate button's tooltip says so, and the result footer names the provider that answered. Text is sent to Microsoft Translator (Bing) only. Nothing is written to disk by this plugin. The local summary and the UI state stay in the page.

## Install

The package is a standard Harness bundle with `dsh.bundle.patch` and a `dsh.client` half. For a profile managed by the desktop app, install the directory through the Plugin Manager (or select it as a profile bundle) and let the client module reload. No npm dependencies are added.

After changing `client.js` by hand, restart the app: the client bundle is served immutably, and a page refresh alone keeps the old revision. Host route changes need a restart too.

Package: `@local/whale-translator`

## Companion browser extension

The `extension/` folder is a standalone Manifest V3 extension for Edge/Chrome. It does not depend on the DSH process, so it also works when DSH is closed:

1. Open `edge://extensions` (or `chrome://extensions`).
2. Enable Developer mode.
3. Load unpacked → select `plugins/whale-translator/extension`.
4. Select text on any normal web page.

See [`extension/README.md`](extension/README.md) for permissions, scope, and privacy.

## Test

```sh
npm test
```

The test file mocks `fetch`; it does not call the network.

## Notes

- The whale glyph is an original composition built on the Lucide `whale` outline (ISC). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- The public translator endpoint is unofficial. If it is unavailable, the card reports a short failure and offers retry.
- **AI 搜索** opens an ordinary Bing search for the selection; it is not a separate model call.
