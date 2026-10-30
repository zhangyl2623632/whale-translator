# Whale Translator · Browser Extension / 鲸译 · 浏览器扩展

[English manual](../README.md) | [中文手册](../README.zh.md)

This folder is the unpacked Manifest V3 extension. The full product manual covers install, the Developer-mode requirement, permissions, privacy, troubleshooting, and the roadmap.

![Whale Translator toolbar and card](preview.png)

## Quick install / 快速安装

1. Open `edge://extensions` (Chrome: `chrome://extensions`). / 打开扩展页。
2. Enable **Developer mode**. / 打开 **开发者模式**。
3. **Load unpacked** → this folder. / 点 **加载解压缩的扩展**，选择本目录。
4. Select text on any `http(s)` page. / 在任意 `http(s)` 网页选中文字。

> **Developer mode is required for an unpacked extension.** A `.crx` file alone does not remove this requirement; a store listing or an enterprise policy is needed for a Developer-mode-free install. See the [English manual](../README.md#install) or [中文手册](../README.zh.md#安装).
>
> **解压缩扩展必须开启开发者模式。** 只装 `.crx` 不能绕过；免开发者模式需要商店上架或企业策略。详见 [中文手册](../README.zh.md#安装)。

## Scope / 范围

- **Supported:** Edge/Chrome `http(s)` pages, `contenteditable` editors, same-page iframes. / 支持网页、`contenteditable`、iframe。
- **Not supported:** `edge://`, `chrome://`, the extension store, and other desktop apps. / 不支持浏览器内部页面、扩展商店和其他桌面应用。
- **Outbound data:** selected text is sent only after **Translate** is clicked, to `edge.microsoft.com`. No history, no disk writes. / 只在点击翻译后发送选中文字到 `edge.microsoft.com`，不保存历史、不写磁盘。

For the desktop-wide version (Word, WeChat, any Windows app), see the “Roadmap” section of the [manual](../README.md#roadmap).
