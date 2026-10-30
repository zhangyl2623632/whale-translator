# Permissions and review answers / 权限与审核说明

## Manifest summary

| Permission / field | Why it exists |
|---|---|
| `clipboardWrite` | Copy original / translation when the user clicks a copy button. The extension never reads the clipboard. |
| `host_permissions: https://edge.microsoft.com/*` | Send the selected text to Microsoft's Edge translator endpoint. This is the only network destination. |
| `content_scripts.matches: <all_urls>` | Show the selection toolbar on any `http(s)` page the user chooses to translate. |
| `content_scripts.all_frames` | Support selections inside same-page iframes. |
| `content_scripts.match_about_blank` | Support `about:blank` frames that inherit the parent origin. |
| `action.default_popup` | Small help popup; no additional permission. |
| No `tabs` | Not requested. The only tab API use is `chrome.tabs.create` for the user-initiated Bing search; creating a tab does not require the `tabs` permission. |
| No `storage` | No history, settings, or identifiers are persisted. |
| No `webRequest` / `cookies` / `history` | Not needed. |
| No remote code | All JS is packaged; no `eval` of remote content; no external scripts. |

Verified: `chrome.tabs.create` is used only for the user-initiated Bing search. The `tabs` permission is not required to create a tab, and it is not requested.

## Partner Center permission justification (English)

```text
clipboardWrite: Used only when the user clicks "Copy original" or "Copy translation". The extension never reads the clipboard.

host_permissions (https://edge.microsoft.com/*): The extension sends the selected text to Microsoft's Edge translator endpoint to obtain the translation. This is the only network destination.

content_scripts (<all_urls>): A selection translator must be able to show its toolbar on any web page the user chooses. It does not read or transmit page content unless the user selects text and clicks Translate.

all_frames / match_about_blank: Selections can occur inside same-page iframes; the toolbar must follow the selection there too.
```

## Partner Center permission justification (中文)

```text
clipboardWrite：仅在用户点击“复制原文”或“复制译文”时写入剪贴板；扩展不读取剪贴板。

host_permissions（https://edge.microsoft.com/*）：把用户选中的文字发送到 Microsoft Edge 翻译端点以获取译文；这是唯一的网络目标。

content_scripts（<all_urls>）：划词翻译需要在用户选择的任意网页上显示工具栏；用户未选中文字并点击“翻译”前，不读取、不发送页面内容。

all_frames / match_about_blank：选区可能位于同页 iframe 中，工具栏需要跟随选区显示。
```

## Single purpose

```text
Translate selected text on web pages between Chinese and English and show only the translation in a compact card.
```

## Remote code

```text
No. The extension does not load or execute remotely hosted code.
```

## Data usage

| Question | Answer |
|---|---|
| Collects selected text / user content? | Yes, transmitted to Bing only after clicking Translate. |
| Collects personally identifiable information? | No. |
| Collects health / financial / authentication data? | No. |
| Collects location? | No. |
| Collects browsing history or page URLs? | No. |
| Uses analytics or advertising? | No. |
| Sells or shares data? | No. |
| Retains data? | No extension-side retention; bounded in-memory cache in the service worker. |
| Uses clipboard? | Write-only, only when the user clicks copy. |

## Verified API usage

`chrome.tabs.create` is used only for the user-initiated Bing search. Creating a tab does not require the `tabs` permission, and the extension does not request it. No other tab metadata is read.
