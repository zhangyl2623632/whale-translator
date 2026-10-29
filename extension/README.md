# 鲸译 · 浏览器扩展

这是 `whale-translator` 的 companion 浏览器扩展（Chrome / Edge，Manifest V3）。它把同一套“选中文字 → 点翻译 → 只显示译文”的体验带到 DSH 之外的网页。

![鲸译浏览器扩展](preview.png)

## 安装（Edge / Chrome）

1. 打开 `edge://extensions`（Chrome 是 `chrome://extensions`）。
2. 打开“开发人员模式 / Developer mode”。
3. 点“加载解压缩的扩展 / Load unpacked”。
4. 选择本目录 `plugins/whale-translator/extension`。
5. 打开任意 `http://` / `https://` 网页，选中文字即可看到鲸译工具栏。

> 浏览器内部页面（`edge://`、`chrome://`、扩展商店）不允许注入，这是浏览器限制。

## 它做什么

- 选中文字后浮出鲸鱼工具栏；点击 **翻译** 才发送文字，不会自动请求。
- 中英自动方向，保留原有换行；结果只显示译文。
- 支持普通网页、`contenteditable` 富文本编辑器（Jira / Confluence / Notion 等）和 iframe 内的选择。
- 工具栏渲染在 shadow root 里，页面 CSS 不会污染它。
- 翻译走扩展的 MV3 service worker（有 `edge.microsoft.com` host permission），不经过 DSH 进程，因此 DSH 关闭也能用。
- 首次加载会预热 service worker / TLS；失败时快速提示并给重试按钮，不再等慢速备用接口。

## 权限

- `host_permissions: https://edge.microsoft.com/*`：只用于翻译请求。
- `clipboardWrite`：复制译文/原文。
- `content_scripts` 匹配 `<all_urls>`：在网页里显示工具栏。
- 没有 `tabs`、`storage`、`webRequest` 权限。

## 隐私

选中文字只在点击 **翻译** 后发送给 Microsoft Translator（Bing）。扩展不保存历史、不写入磁盘；缓存只在 service worker 内存里。

## 和 DSH 插件的关系

DSH 插件运行在 DSH Web UI 的页面容器里，受浏览器同源策略限制，无法注入其他网站；本扩展是独立的浏览器宿主，因此能覆盖任意网页。两者共用同一套翻译思路，但代码分开打包，互不依赖。
