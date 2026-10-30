# Whale Translator — Privacy Policy / 隐私政策

**Effective date / 生效日期:** 2026-10-30

Whale Translator（鲸译 · 划词翻译）is a selection translator for Microsoft Edge and Chrome, and for DeepSeek Harness. This policy explains what the browser extension and the DSH plugin send, when they send it, and what they keep.

Whale Translator（鲸译 · 划词翻译）是用于 Microsoft Edge、Chrome 和 DeepSeek Harness 的划词翻译工具。本政策说明浏览器扩展与 DSH 插件发送什么、何时发送、保留什么。

## 1. What is sent

When you select text and click **翻译 / Translate**, the extension or DSH plugin sends:

- the selected text;
- the requested source and target language settings (for example, auto-detect → Chinese).

The browser extension sends this to `https://edge.microsoft.com/translate/translatetext` (Microsoft Translator / Bing). The DSH plugin sends it through the local DeepSeek Harness route to the same Microsoft endpoint. Microsoft processes the request under its own privacy terms:

- https://privacy.microsoft.com/privacystatement

**Nothing is sent before you click Translate.** Selecting text alone does not transmit it. The extension does not send the page URL, page title, browsing history, cookies, account identifiers, or device identifiers.

## 2. What is not collected

The extension and plugin do **not** collect, sell, rent, or share:

- browsing history or page URLs;
- names, email addresses, accounts, or other identifiers;
- location data;
- health, financial, or authentication information;
- analytics, advertising IDs, or telemetry.

There are no analytics SDKs, ads, trackers, or remote scripts.

## 3. Local storage and retention

The browser extension does **not** keep a translation history and does **not** write translations to disk. Successful results may be cached in the MV3 service worker's memory to avoid duplicate requests; that cache is bounded, lives only in memory, and disappears when the worker is stopped or the browser closes.

The DSH plugin keeps a bounded in-memory cache in the host process and writes no translation history to disk.

Clipboard access is **write-only** and occurs only when you click a copy button. The extension does not read your clipboard.

## 4. Permissions

| Permission | Purpose |
|---|---|
| `clipboardWrite` | Copy original / translation when you click a copy button. |
| `https://edge.microsoft.com/*` | Send the selected text to Microsoft's translator endpoint. |
| Content script on `http(s)` pages / all frames | Show the selection toolbar on the page and inside same-page iframes. |
| `action` popup | Show usage help; no data collection. |

The extension does not request `tabs`, `storage`, `webRequest`, `cookies`, or `history`.

## 5. Third parties

The only translation processor is Microsoft (Edge translator / Bing). Microsoft's privacy statement applies to the text sent to its endpoint. The extension does not use any other third-party service.

## 6. Children

The extension is not directed to children under 13 and does not knowingly collect personal information from children.

## 7. Changes

If this policy changes, the effective date above will be updated and the new version will be published at the same URL. Material changes will be reflected in the store listing or release notes.

## 8. Contact

Questions or requests: open an issue at

https://github.com/zhangyl2623632/whale-translator/issues

---

# 中文

## 1. 发送什么

当你选中文字并点击 **翻译** 时，扩展或 DSH 插件会发送：

- 选中的文字；
- 目标语言设置（例如自动检测 → 中文）。

浏览器扩展发送到 `https://edge.microsoft.com/translate/translatetext`（Microsoft Translator / Bing）；DSH 插件通过本机 DeepSeek Harness 路由发送到同一个 Microsoft 端点。Microsoft 按其隐私声明处理请求：

- https://privacy.microsoft.com/privacystatement

**点击翻译之前不会发送任何内容。** 仅选中文字不会传输。扩展不会发送页面 URL、页面标题、浏览历史、Cookie、账号标识或设备标识。

## 2. 不收集什么

扩展和插件**不**收集、出售、出租或共享：

- 浏览历史或页面 URL；
- 姓名、邮箱、账号或其他标识；
- 位置数据；
- 健康、财务或认证信息；
- 分析、广告 ID 或遥测。

没有分析 SDK、广告、跟踪器或远程脚本。

## 3. 本地存储与保留

浏览器扩展**不**保存翻译历史，**不**把译文写入磁盘。成功结果可能缓存在 MV3 service worker 的内存中，避免重复请求；缓存有上限，只存在内存中，service worker 停止或浏览器关闭后消失。

DSH 插件在宿主进程内保留有界内存缓存，不向磁盘写翻译历史。

剪贴板为**只写**，且仅在你点击复制按钮时使用；扩展不读取剪贴板。

## 4. 权限

| 权限 | 用途 |
|---|---|
| `clipboardWrite` | 点击复制按钮时写入原文/译文。 |
| `https://edge.microsoft.com/*` | 把选中文字发送到 Microsoft 翻译端点。 |
| `http(s)` 页面 / 所有 frame 的 content script | 在页面和同页 iframe 中显示划词工具栏。 |
| `action` popup | 显示使用帮助；不收集数据。 |

扩展不申请 `tabs`、`storage`、`webRequest`、`cookies` 或 `history`。

## 5. 第三方

唯一的翻译处理方是 Microsoft（Edge 翻译 / Bing）。发送到其端点的文字适用 Microsoft 隐私声明。扩展不使用其他第三方服务。

## 6. 儿童

本扩展不面向 13 岁以下儿童，也不会有意收集儿童个人信息。

## 7. 变更

如果本政策变化，会更新上方生效日期，并在同一 URL 发布新版本。重大变化会在商店 listing 或 release notes 中说明。

## 8. 联系

问题或请求：请到

https://github.com/zhangyl2623632/whale-translator/issues
