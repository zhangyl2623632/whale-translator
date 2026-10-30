# Edge Add-ons listing — 中文（简体）

> 把本文件里对应字段直接复制到 Partner Center。**Extension name**、**Short description** 来自 `manifest.json`，在 Partner Center 只读。

## 基本信息

| 字段 | 值 |
|---|---|
| Extension name | 鲸译 · 划词翻译 |
| Short description | 在任意网页选中文字，点「翻译」在中英之间互译；保留原有换行，只在点击后发送文字。 |
| Category | Productivity |
| Pricing | Free |
| Mature content | No |
| Visibility | **Hidden**（推荐，只给朋友用）；需要公开搜索时再改 Public |
| Markets | All markets（或仅中国） |
| Language | 中文（简体） |
| Website | https://github.com/zhangyl2623632/whale-translator |
| Support | https://github.com/zhangyl2623632/whale-translator/issues |
| Privacy policy | https://zhangyl2623632.github.io/whale-translator/privacy.html |

## Description（复制到 Store listing → 中文（简体）→ Description）

```text
鲸译是一个只在你想翻译时才出现的划词翻译工具。

在任意网页中选中文字，工具栏会浮现在选区上方；点击“翻译”，卡片只显示译文，不重复原文。自动检测中英文，也可以在卡片里切换目标语言。译文保留原有换行；长文本会分块请求，超过 12,000 字符会提示缩短选区。

主要功能：
• 中英互译，自动检测源语言
• 只显示译文，保留换行
• 复制原文或译文
• 用浏览器语音朗读原文或译文
• 本地抽取式总结，快速抓住重点
• 在 Bing 中搜索选区
• 深色工具栏 + 波浪玻璃卡片，明暗主题都清晰

隐私说明：
• 只有点击“翻译”后，选区文字才会发送到 edge.microsoft.com（Microsoft Translator / Bing）
• 不保存翻译历史，不写入磁盘，不做分析或广告
• 复制按钮只在点击时使用剪贴板
• 不申请 tabs、storage、webRequest 权限

适用范围：
• Edge/Chrome 的 http(s) 网页
• 支持 contenteditable 编辑器，例如 Jira、Confluence、Notion
• 不支持 edge://、chrome://、扩展商店等浏览器内部页面
• 不支持 Word、微信等桌面应用；全应用桌面版在路线图中

安装后不需要开发者模式。扩展从 Edge 加载项安装，更新由浏览器管理。
```

> 长度检查：以上描述超过 250 个字符，低于 10,000 个字符。

## Search terms（最多 7 个，合计最多 21 个词）

```text
翻译
划词翻译
中英互译
网页翻译
Bing 翻译
selection translator
```

## Assets

| 字段 | 文件 |
|---|---|
| Extension logo（300×300，1:1） | `assets/logo-300x300.png` |
| Screenshot 1（1280×800） | `assets/screenshot-1-1280x800.png` |
| Screenshot 2（1280×800） | `assets/screenshot-2-1280x800.png` |
| Small promotional tile（440×280） | `assets/promo-440x280.png` |
| Large promotional tile（1400×560） | `assets/promo-1400x560.png` |
| YouTube video | 不提供 |

## Privacy answers

### Single purpose

```text
Translate the text a user selects on a web page between Chinese and English, and show only the translation in a small card.
```

### Permission justification

```text
clipboardWrite — Used only when the user clicks "Copy original" or "Copy translation". No clipboard read access is requested.

host_permissions https://edge.microsoft.com/* — The extension sends the selected text to Microsoft's Edge translator endpoint to obtain the translation. This is the only network destination.

content_scripts <all_urls> — The extension must be able to show the selection toolbar on any web page the user chooses to translate. It does not read or transmit page content unless the user clicks Translate.

all_frames — Selections can occur inside same-page iframes; the toolbar must follow the selection there as well. match_about_blank covers about:blank frames that inherit the parent origin.
```

### Remote code

```text
No.
```

### Data usage

- Transmits: selected text, source/target language.
- Destination: `https://edge.microsoft.com` (Microsoft Translator / Bing).
- When: only after the user clicks **翻译 / Translate**.
- Retention by extension: none; no history, no disk writes, only an in-memory cache in the service worker.
- Sale/advertising/analytics: none.
- Clipboard: write-only; only on explicit copy.
- The privacy policy URL must match these answers.

### Certification notes

Use `review-notes.md`.
