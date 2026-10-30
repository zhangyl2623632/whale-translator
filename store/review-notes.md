# Certification test notes — Whale Translator (鲸译 · 划词翻译)

## What the extension does

Whale Translator translates the text a user selects on a web page between Chinese and English. It shows a small toolbar above the selection; nothing is sent anywhere until the user clicks **翻译 (Translate)**. The result card shows only the translation and preserves the original line breaks.

There is no account, login, backend service, or test credential.

## Test steps

1. Install the submitted package and pin the extension (optional).
2. Open any normal `http(s)` page, for example `https://example.com`.
3. Select a paragraph of English text with the mouse.
4. A dark whale toolbar appears above the selection.
5. Click **翻译**. A result card opens below the selection and requests a translation from Microsoft's Edge translator endpoint.
6. Expected: the card shows a Chinese translation, the original line breaks are preserved, and the source text is not repeated.
7. Click **复制译文 (Copy translation)**; the button changes to **已复制译文**.
8. Click **关闭 (Close)** or press Escape; the card closes.
9. Click the extension's toolbar icon; a small help popup opens with usage steps and a privacy note.

For Chinese → English, select Chinese text and use the same steps. The target language can also be changed in the card.

## Permissions

- `clipboardWrite`: only for the copy buttons. The extension never reads the clipboard.
- `https://edge.microsoft.com/*`: the translation request destination.
- Content script on `<all_urls>` and `all_frames`: required to show the toolbar on any page and inside same-page iframes. The extension does not read or transmit page content unless the user selects text and clicks Translate.
- No `tabs`, `storage`, `webRequest`, `cookies`, or `history` permissions.
- No remote code. All JavaScript ships in the package.

## Data flow

- Outbound: selected text + source/target language, only after **翻译** is clicked.
- Destination: `https://edge.microsoft.com/translate/translatetext`.
- Stored by extension: nothing on disk; a bounded in-memory cache in the MV3 service worker.
- No analytics, advertising, tracking, or sale of data.

## Notes for testers

- The translation endpoint is Microsoft's public Edge translator endpoint. It can occasionally be slow or rate-limited; the card offers **重试 (Retry)**.
- Browser-internal pages (`edge://`, `chrome://`, the extension store) cannot be injected by design.
- The extension skips `input`, `textarea`, and `select`; it supports `contenteditable` editors.
- If the extension is reloaded while a page is already open, refresh the page before testing; the content script from the previous extension revision is invalidated.
- The UI is Chinese. The store listing description explains this.
- The toolbar icon opens a help popup; it is not the translation trigger.
- If the translation fails because the endpoint is unreachable from the review network, retry or test from another network; this is an upstream network dependency, not a missing permission.

## Contact

GitHub issues: https://github.com/zhangyl2623632/whale-translator/issues
