# 鲸译 · Whale Translator

[English](README.md) | **中文**

面向 **DeepSeek Harness** 的划词翻译插件，以及一个可在任意网页使用的 companion 浏览器扩展。选中文字，点 **翻译**，只显示译文；不点击就不会发送任何内容。

![鲸译工具栏与译文卡片](extension/preview.png)

## 产品地图

| 形态 | 状态 | 适用位置 | 安装方式 |
|---|---|---|---|
| **DSH 插件** | 可用，`1.0.0` | DeepSeek Harness Web UI | 插件管理器 / profile bundle |
| **浏览器扩展** | 可用，解压缩加载 | Edge / Chrome 的 `http(s)` 网页 | Load unpacked（需要开发者模式） |
| **全应用桌面版** | 规划中 | Word、微信、Windows 任意应用 | 独立桌面程序，不在本包内 |
| **商店 / CRX 安装** | 商店材料已备好，尚未提交 | 免开发者模式安装 | Edge 加载项上架或企业策略 |
| **DSH 翻译** | 可用（`ctx.translator` + Bing fallback） | DSH 后端 | 优先使用应用翻译服务 |

两种已交付形态彼此独立：DSH 插件在 Harness 内运行，浏览器扩展在 Edge/Chrome 内运行；可以只用其中一个。

## 功能

- **先选区，后翻译。** 选中文字后浮出鲸鱼工具栏；只有点击 **翻译** 才开始请求。
- **DSH 原生翻译。** 在 DSH 内优先使用宿主的 `ctx.translator` 服务；没有可用 provider 时回退到 Bing 直连。
- **中英互译。** 在本地检测原文语言；卡片内可切换目标语言。
- **保留换行。** 翻译后会校验换行结构；若结构变化，则逐行重译，并还原每行原有的前后空白。
- **只显示译文。** 卡片不重复原文，不加 “Translation:” 前缀。
- **工具栏动作。** 复制、浏览器语音朗读、本地抽取式总结、在 Bing 中搜索，以及更多菜单。
- **快速失败，不再慢速兜底。** 上游只有 Bing。超时或网络错误会快速报错并提供 **重试**；旧的慢速 MyMemory 兜底已移除。
- **有界处理。** 单次最多 12,000 字符；长文本分块并发翻译；DSH 路由总预算 12 秒，客户端等待 15 秒。
- **鲸鱼主题。** 手绘线稿鲸鱼、深海海军蓝、生物荧光青与波浪玻璃卡片。工具栏在明暗主题下都保持深色，卡片跟随宿主主题。

## 安装

### A. DSH 插件（Harness 内推荐）

本包是标准 Harness bundle，包含 `dsh.bundle.patch` 和 `dsh.client`。

1. 打开 DSH 插件管理器。
2. 安装目录 `plugins/whale-translator`（或作为 profile bundle 加入）。
3. 让客户端模块重新加载，或重启 DSH。

不新增 npm 依赖。包名：`@local/whale-translator`。

> 手工修改 `client.js` 或 `index.js` 后需要重启 DSH。客户端 bundle 是不可变缓存，只刷新页面仍会使用旧版本。

### B. 浏览器扩展（Edge / Chrome）

1. 打开 `edge://extensions`（Chrome 为 `chrome://extensions`）。
2. 打开 **开发者模式 / Developer mode**。
3. 点击 **加载解压缩的扩展 / Load unpacked**，选择 `plugins/whale-translator/extension`。
4. 打开任意 `http://` 或 `https://` 网页，选中文字。

> **解压缩扩展必须开启开发者模式。** Edge/Chrome 只会在开发者模式下加载 unpacked 扩展。仅安装一个 `.crx` **不能**绕过这个限制；免开发者模式安装需要商店上架，或通过企业策略强制安装带更新地址的签名 CRX。

**不开开发者模式时的选择：**

| 方案 | 需要什么 | 说明 |
|---|---|---|
| Edge 加载项 | 个人或公司账号（Edge 不收注册费）、审核 | 商店材料已备好，尚未提交；给其他人免开发者模式安装的正规路径 |
| 企业策略 | 管理员权限、可访问的签名 CRX + update XML | 个人 PC 技术上能设，但面向受管机群；一个人用不值得 |
| 只用 DSH 插件 | 运行 DSH | 只覆盖 Harness 页面，不需要开发者模式 |
| `--load-extension` 快捷方式 | 一个带启动参数的浏览器快捷方式 | 仅限高级/测试用途；不是正常安装，浏览器已运行时可能被忽略 |

浏览器内部页面（`edge://`、`chrome://`、扩展商店）不能注入，这是浏览器限制，不是配置问题。

### C. 更新 / 卸载

- **DSH 插件：** 重新安装目录或更新 link 包，然后重启 DSH。
- **浏览器扩展：** 修改扩展文件后，在 `edge://extensions` 点 **重新加载 / Reload**；点 **删除 / Remove** 卸载。
- 解压缩扩展指向磁盘目录。请保留 `plugins/whale-translator/extension` 的位置；移动后需要从新路径重新加载。

## 使用

### 在 DSH 内

在对话中选中文字，工具栏出现在选区上方。点击 **翻译**，译文卡片出现在选区下方，并保留原有换行。

- `input`、`textarea`、`select`、`contenteditable`、`pre`、`code` 中的选区会被刻意忽略，避免打断输入、编辑或复制代码。
- 跨域 iframe 内的选区不在 DSH 文档内，插件看不到。
- 关闭工具栏（X、Esc、**关闭工具栏**、滚动或点击别处）后，同一选区不会立刻弹回，直到下一次交互。

### 在浏览器内

在普通网页中选中文字，包括 `contenteditable` 富文本编辑器（Jira、Confluence、Notion 等）。点击 **翻译**，译文卡片出现在选区附近。

- 跳过 `input` / `textarea` 选区；支持 `contenteditable`。
- 支持 `http(s)` 页面与 iframe；不支持浏览器内部页面。
- 卡片支持重试、复制、朗读、本地总结；**更多** 菜单还提供复制原文、复制译文和关闭。

## 权限与隐私

### DSH 插件

| 项目 | 说明 |
|---|---|
| 路由 | `POST /api/dsh/whale-translator/translate` |
| 外发数据 | 只有点击 **翻译** 时才发送选中文字 |
| 上游 | `edge.microsoft.com`（Microsoft Translator / Bing） |
| 本地数据 | 原文、译文、总结都留在页面内 |
| 磁盘 | 不向磁盘写翻译历史 |
| 限制 | 12,000 字符；96 KiB 请求体；宿主 12 秒预算 |

### 浏览器扩展

| 权限 | 用途 |
|---|---|
| `host_permissions: https://edge.microsoft.com/*` | 在 MV3 service worker 中发翻译请求 |
| `clipboardWrite` | 复制原文 / 译文 |
| `content_scripts: <all_urls>` | 在网页中显示工具栏 |
| 不需要 `tabs`、`storage`、`webRequest` | 未申请 |

扩展只在点击 **翻译** 后发送文字；不保存历史、不写磁盘；缓存只在 service worker 内存中。

## 工作原理

### DSH 插件

- `client.js` 在 `shell.overlay` 槽位注册全框浮层；监听 `mouseup`、`touchend`、`selectionchange`（防抖）和 Shift+keyup；排除可编辑/代码区域；按选区视口矩形定位。
- `index.js` 注册一个 same-origin 路由；校验 `application/json`、限制 96 KiB、对 HTTP 429/5xx 重试一次、按并发分块翻译，并在内存中缓存成功结果。
- 路由使用 Edge 的非官方翻译端点；端点不可用时快速返回错误并提供重试。

### 浏览器扩展

- MV3 service worker 负责翻译；content script 负责渲染工具栏和卡片。
- content script 使用固定定位的页面级浮层和带 `wt-` 前缀的 scoped CSS；只有工具栏/卡片区域接收点击，页面其他区域保持可交互。
- 页面加载和选中文字时预热 service worker / TLS，降低冷启动延迟。
- 不依赖 DSH 进程；DSH 关闭时扩展仍可使用。

## 安全状态

DSH 路由现在要求**按进程生成的页面 token**，并保留 same-origin、`application/json`、body 大小校验。token 在宿主插件加载时生成，作为 meta 注入 DSH 页面 head，客户端用 `x-whale-translator-token` 发送；如果页面里没有 meta，客户端会从同一路由的 same-origin `GET` 取 token。没有 token 的请求会收到 `403`，不会到达 Bing。宿主重启后 token 会轮换；请刷新 DSH 页面，如果运行中的客户端早于宿主代码，需要完全重启 DSH。

路由不存储、不记录选中文字。如果 DSH Web 服务被暴露到 localhost 之外，仍应依赖 DSH 自身的鉴权；请保持 localhost 或置于常规访问控制之后。

DSH 插件现在优先使用 `ctx.translator`（宿主有可用的匿名 provider 时），并保留 Bing 直连作为 fallback。需要付费/会话的 provider 留给后续 DSH 配置。

## 故障排查

| 现象 | 检查 |
|---|---|
| DSH 里工具栏不出现 | 插件是否启用？选区起点是否在 `input`/`textarea`/`contenteditable`/`pre`/`code` 内？客户端 bundle 是否为新版本？修改后重启 DSH。 |
| 浏览器里工具栏不出现 | 扩展是否启用？**站点访问权限** 是否为 **在所有站点上**？页面是否为 `edge://`/`chrome://` 或扩展商店？安装/重载扩展后重新加载页面。 |
| 工具栏出现但点翻译没反应 | 在 `edge://extensions` 查看扩展的 **错误**；重载扩展；换一个普通 `http(s)` 页面重试。 |
| 提示“扩展已更新或后台未启动，请刷新页面后重试” | 重载解压缩扩展会让已经打开的页面失效。刷新页面，或点卡片里的 **刷新页面**；若仍失败，重载扩展后再刷新。 |
| 翻译报 HTTP 429 / 超时 | 公共端点被限流或不可达；稍等后点 **重试**，不会自动走慢速兜底。 |
| 提示“翻译鉴权失败，请刷新页面或重启 DSH” | 宿主插件重新生成了页面 token；刷新 DSH 页面。若仍失败，完全重启 DSH。 |
| 第一次翻译很慢 | service worker 或 TLS 连接是冷的；扩展会在页面加载时预热，重试通常更快。 |
| 重启 Edge 后扩展消失 | 解压缩扩展依赖文件夹路径；保留目录，在 `edge://extensions` 重新加载。 |
| `.crx` 安装被阻止 | CRX 仍需开发者模式或企业策略；免开发者模式请走商店或策略。 |

## 限制

- **浏览器扩展：** 只覆盖浏览器页面；不覆盖 Word、微信等桌面应用。
- **开发者模式：** 当前解压缩安装需要；免开发者模式需要商店或企业策略。
- **非官方上游：** Edge 翻译端点不是签约 API，可用性和限流不受保证。
- **文本上限：** 单次 12,000 字符；没有流式输出。
- **界面语言：** 产品内文案为中文；本手册中英双版。
- **DSH 范围：** 插件只能看到 DSH 页面，不能注入其他标签页或 origin。

## 路线图

### 1. 全应用桌面版

独立桌面程序，不在本包内。目标行为类似豆包的桌面划词：

- Windows 全局鼠标钩子（macOS 用 event tap）。
- 通过 UI Automation / 无障碍 API 读取选区；失败时用剪贴板复制/恢复兜底。
- 在光标附近显示置顶浮窗；需要时点击穿透。
- 复用同一套翻译服务；保持“点击后才发送”的隐私规则。

这需要原生/桌面宿主、代码签名和安装器；当前浏览器扩展无法提供。

### 2. 商店 / CRX 打包

- 上架 Edge 加载项和/或 Chrome 网上应用店，实现正常的免开发者模式安装。
- 受管机群：托管签名 CRX + update manifest，使用 `ExtensionSettings` / `ExtensionInstallForcelist`。
- `.crx` 本身不能绕过开发者模式。打包还必须保护签名私钥，私钥绝不能提交到仓库。

### 3. DSH translator 后续

`ctx.translator` 已接入，并保留 Bing 直连 fallback；路由继续保留 same-origin / body / content-type / token 校验。后续可以在 DSH 提供配置后暴露付费/会话 provider 或 provider 选择器。

## 开发

| 路径 | 用途 |
|---|---|
| `client.js` | DSH 客户端浮层与工具栏/卡片 UI |
| `index.js` | DSH 宿主路由、Bing 请求、分块、缓存 |
| `extension/` | 独立 MV3 扩展（service worker、content script、CSS、图标） |
| `test/` | 宿主、路由、客户端契约、扩展 core 的 Node 测试 |
| `store/` | Edge 加载项上架材料：listing、隐私政策、图标、截图、安装包 |
| `locale/` | DSH 插件元数据 |
| `THIRD_PARTY_NOTICES.md` | Lucide 鲸鱼图标归属 |

运行测试：

```sh
npm test
```

测试会 mock `fetch`，不访问网络。没有 npm 运行时依赖。

## 版本

`1.0.0` — DSH 插件 + 解压缩浏览器扩展。

鲸鱼图标基于 Lucide `whale` 线稿再创作（ISC）。见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

本项目使用 MIT License。见 [LICENSE](LICENSE)。
