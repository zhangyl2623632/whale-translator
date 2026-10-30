window.__ModuleLoader__.load({
  id: '@local/whale-translator',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const ROUTE = '/api/dsh/whale-translator/translate'
    const MAX_TEXT = 12000
    const BAR_WIDTH = 516
    const BAR_HEIGHT = 46
    const PANEL_WIDTH = 428
    const PANEL_EST_HEIGHT = 342
    const EDGE = 12
    const GAP = 10

    const HAN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g
    const LATIN_RE = /[A-Za-z]/g

    const STOPWORDS = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had',
      'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
      'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did',
      'she', 'use', 'her', 'than', 'then', 'them', 'these', 'they', 'this', 'that',
      'with', 'have', 'from', 'were', 'will', 'would', 'there', 'their', 'what',
      'when', 'where', 'which', 'while', 'about', 'after', 'again', 'also', 'into',
      'more', 'most', 'other', 'some', 'such', 'only', 'over', 'very', 'just',
    ])

    const CSS = `
.wt-root{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:inherit;font-size:14px;line-height:1.5;color:var(--dsw-alias-label-primary,#101828);-webkit-font-smoothing:antialiased}
.wt-root *{box-sizing:border-box}
.wt-root button{font:inherit}
.wt-root button,.wt-root select{-webkit-tap-highlight-color:transparent}

.wt-bar-wrap{position:fixed;pointer-events:auto;animation:wt-splash .19s cubic-bezier(.2,.8,.2,1)}
.wt-bar{position:relative;isolation:isolate;display:flex;align-items:center;gap:2px;width:100%;padding:5px 6px;border-radius:16px;border:1px solid rgba(158,207,255,.2);background:linear-gradient(180deg,rgba(13,33,58,.97),rgba(5,15,29,.985));box-shadow:0 20px 46px -16px rgba(2,9,22,.72),0 2px 8px rgba(2,9,22,.22),inset 0 1px 0 rgba(255,255,255,.075);color:#edf7ff;backdrop-filter:blur(18px) saturate(1.18);overflow:hidden}
.wt-bar::before{content:"";position:absolute;inset:-60% -20% auto -20%;height:140%;background:radial-gradient(60% 120% at 20% 0%,rgba(77,107,254,.28),transparent 55%),radial-gradient(50% 110% at 92% 100%,rgba(94,234,212,.17),transparent 62%);pointer-events:none;z-index:-1}
.wt-bar::after{content:"";position:absolute;left:13px;right:13px;top:0;height:1px;background:linear-gradient(90deg,transparent 2%,rgba(103,232,249,.65),rgba(77,107,254,.48),rgba(94,234,212,.38),transparent 98%);pointer-events:none}
.wt-brand{display:flex;align-items:center;gap:6px;flex:none;padding:0 4px 0 1px}
.wt-orb{display:grid;place-items:center;width:27px;height:27px;flex:none;border-radius:9px;background:linear-gradient(145deg,#4d6bfe 2%,#2cb4d4 58%,#5eead4);box-shadow:0 4px 14px rgba(77,107,254,.38),inset 0 1px 0 rgba(255,255,255,.34);color:#f7fdff}
.wt-brand-name{font-size:11px;font-weight:650;letter-spacing:.1em;color:#cfe8ff;white-space:nowrap}
.wt-divider{width:1px;height:17px;flex:none;margin:0 4px 0 2px;background:linear-gradient(180deg,transparent,rgba(159,207,255,.28),transparent)}
.wt-actions{display:flex;align-items:center;justify-content:space-between;flex:1;gap:1px;min-width:0}
.wt-action{position:relative;display:flex;align-items:center;gap:5px;flex:none;appearance:none;border:0;border-radius:10px;padding:8px 7px;background:transparent;color:#d7e8fb;font-size:12px;line-height:1;white-space:nowrap;cursor:pointer;transition:background .16s ease,color .16s ease,transform .16s ease}
.wt-action:hover{background:rgba(143,193,255,.12);color:#fff}
.wt-action:active{transform:translateY(1px)}
.wt-action:focus-visible{outline:2px solid #67e8f9;outline-offset:1px}
.wt-action svg{opacity:.82;flex:none}
.wt-action:hover svg{opacity:1}
.wt-action-live{color:#8eeeff}
.wt-action-live svg{opacity:1;filter:drop-shadow(0 0 5px rgba(103,232,249,.55))}
.wt-sep{width:1px;height:15px;flex:none;margin:0 2px;background:rgba(159,207,255,.15)}

.wt-more{position:absolute;top:calc(100% + 8px);right:2px;min-width:166px;padding:5px;border-radius:13px;border:1px solid rgba(150,203,255,.22);background:linear-gradient(180deg,rgba(13,31,54,.985),rgba(6,17,31,.995));box-shadow:0 22px 48px -16px rgba(2,9,22,.7),0 2px 8px rgba(2,9,22,.24);animation:wt-pop .14s ease-out;pointer-events:auto}
.wt-more::before{content:"";position:absolute;right:15px;top:-5px;width:8px;height:8px;transform:rotate(45deg);border-left:1px solid rgba(150,203,255,.22);border-top:1px solid rgba(150,203,255,.22);background:#0b1d33}
.wt-more-up{top:auto;bottom:calc(100% + 8px)}
.wt-more-up::before{top:auto;bottom:-5px;border-left:0;border-top:0;border-right:1px solid rgba(150,203,255,.22);border-bottom:1px solid rgba(150,203,255,.22)}
.wt-more-item{display:flex;align-items:center;gap:8px;width:100%;appearance:none;border:0;border-radius:8px;background:transparent;color:#dcecff;font-size:12px;line-height:1.4;padding:8px 9px;text-align:left;cursor:pointer}
.wt-more-item:hover{background:rgba(143,193,255,.12);color:#fff}
.wt-more-item:focus-visible{outline:2px solid #67e8f9;outline-offset:-1px}
.wt-more-item svg{opacity:.72;flex:none}
.wt-more-item-danger{color:#ffb7bf}
.wt-more-item-danger:hover{background:rgba(255,120,135,.12)}

.wt-panel{position:fixed;pointer-events:auto;display:flex;flex-direction:column;overflow:hidden;border-radius:20px;border:1px solid rgba(129,183,255,.26);background:var(--dsw-alias-bg-overlay,#fff);box-shadow:0 34px 88px -24px rgba(2,10,24,.58),0 3px 12px rgba(2,10,24,.12);animation:wt-rise .22s cubic-bezier(.2,.8,.2,1);outline:none}
.wt-panel:focus-visible{box-shadow:0 0 0 2px rgba(77,107,254,.35),0 34px 88px -24px rgba(2,10,24,.58)}
.wt-head{position:relative;isolation:isolate;display:flex;align-items:center;gap:10px;flex:none;padding:13px 13px 13px 15px;color:#f2f8ff;background:linear-gradient(132deg,#0b1e38 0%,#08182c 48%,#0b2933 100%);overflow:hidden}
.wt-head::before{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(70% 170% at 4% -30%,rgba(77,107,254,.48),transparent 58%),radial-gradient(60% 150% at 102% 115%,rgba(45,212,191,.24),transparent 62%)}
.wt-head::after{content:"";position:absolute;left:-10%;right:-10%;bottom:-23px;height:44px;z-index:-1;background:repeating-radial-gradient(ellipse at 50% 120%,transparent 0 19px,rgba(150,223,255,.08) 20px 21px,transparent 22px 38px);opacity:.9;pointer-events:none}
.wt-head-orb{display:grid;place-items:center;width:36px;height:36px;flex:none;border-radius:12px;background:linear-gradient(145deg,#4d6bfe 0%,#2aa8d2 60%,#5eead4 100%);box-shadow:0 7px 20px -6px rgba(52,152,255,.72),inset 0 1px 0 rgba(255,255,255,.34);color:#fff}
.wt-head-copy{flex:1;min-width:0}
.wt-head-title{font-size:15px;font-weight:650;letter-spacing:.08em;line-height:1.25;color:#f5faff}
.wt-head-sub{margin-top:3px;font-size:10px;line-height:1.3;letter-spacing:.15em;color:#9fc5e9;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wt-head-actions{display:flex;align-items:center;gap:1px;flex:none;margin-left:4px}
.wt-icon-btn{display:grid;place-items:center;width:28px;height:28px;appearance:none;border:0;border-radius:9px;background:transparent;color:#c3dcf6;cursor:pointer;transition:background .15s ease,color .15s ease}
.wt-icon-btn:hover{background:rgba(179,218,255,.12);color:#fff}
.wt-icon-btn:focus-visible{outline:2px solid #67e8f9;outline-offset:1px}

.wt-body{position:relative;display:flex;flex-direction:column;flex:1;min-height:0;padding:13px 15px 12px;overflow-x:hidden;overflow-y:auto;background:var(--dsw-alias-bg-overlay,#fff);color:var(--dsw-alias-label-primary,#101828);scrollbar-width:thin}
.wt-body::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(80% 46% at 104% -6%,rgba(77,107,254,.075),transparent 62%),radial-gradient(72% 46% at -8% 108%,rgba(45,212,191,.06),transparent 66%)}
.wt-body > *:not(.wt-watermark){position:relative;z-index:1}
.wt-watermark{position:absolute;right:-24px;bottom:10px;width:168px;height:168px;color:var(--dsw-alias-label-primary,#101828);opacity:.028;pointer-events:none;z-index:0}

.wt-langs{display:flex;align-items:center;gap:9px;flex:none;min-height:43px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1,rgba(16,24,40,.1));border-radius:12px;background:var(--dsw-alias-bg-layer-1,rgba(16,24,40,.035))}
.wt-detect{display:flex;align-items:center;gap:6px;flex:1;min-width:0}
.wt-dot{width:6px;height:6px;flex:none;border-radius:50%;background:#2fc7bb;box-shadow:0 0 0 3px rgba(47,199,187,.12)}
.wt-detect-label{font-size:12px;font-weight:560;line-height:1.2;color:var(--dsw-alias-label-primary,#101828);white-space:nowrap}
.wt-tag{display:inline-flex;align-items:center;max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 6px;border-radius:5px;border:1px solid rgba(77,107,254,.16);background:rgba(77,107,254,.07);font-size:9.5px;line-height:1.35;letter-spacing:.04em;color:#4169c9}
.wt-flow{flex:none;display:grid;place-items:center;width:22px;height:22px;color:var(--dsw-alias-label-tertiary,#8b96a8)}
.wt-target-col{flex:1;min-width:0;display:flex;justify-content:flex-end}
.wt-target-wrap{position:relative;display:flex;align-items:center;justify-content:flex-end;min-width:0;max-width:100%}
.wt-target{appearance:none;-webkit-appearance:none;max-width:100%;border:0;background:transparent;color:var(--dsw-alias-label-primary,#101828);font:inherit;font-size:12.5px;font-weight:650;line-height:1.2;padding:4px 19px 4px 2px;margin:0;cursor:pointer;text-overflow:ellipsis;outline:none}
.wt-target:focus-visible{border-radius:6px;box-shadow:0 0 0 2px rgba(77,107,254,.32)}
.wt-chevron{position:absolute;right:1px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--dsw-alias-label-tertiary,#8b96a8)}

.wt-content{margin-top:10px;min-height:122px;display:flex;flex-direction:column}
.wt-result{flex:1;padding:5px 2px 3px;font-size:15px;line-height:1.86;letter-spacing:.012em;color:var(--dsw-alias-label-primary,#101828);white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;tab-size:2}
.wt-result-summary{font-size:13.5px;line-height:1.8}

.wt-loading{display:flex;flex-direction:column;gap:15px;padding:12px 2px 3px}
.wt-loading-line{display:flex;align-items:center;gap:9px;font-size:11.5px;color:var(--dsw-alias-label-secondary,#5f6b7a)}
.wt-wave{display:inline-flex;align-items:flex-end;gap:3px;height:13px}
.wt-wave span{display:block;width:3px;border-radius:99px;background:linear-gradient(180deg,#67e8f9,#4d6bfe);animation:wt-wave 1s ease-in-out infinite}
.wt-wave span:nth-child(1){height:6px;animation-delay:-.18s}
.wt-wave span:nth-child(2){height:12px;animation-delay:-.06s}
.wt-wave span:nth-child(3){height:8px;animation-delay:.06s}
.wt-skeleton{display:flex;flex-direction:column;gap:10px;padding-top:2px}
.wt-skeleton i{display:block;height:9px;border-radius:99px;background:linear-gradient(90deg,var(--dsw-alias-bg-layer-2,rgba(16,24,40,.06)) 0%,var(--dsw-alias-bg-layer-1,rgba(16,24,40,.035)) 45%,var(--dsw-alias-bg-layer-2,rgba(16,24,40,.06)) 100%);background-size:220% 100%;animation:wt-shimmer 1.55s ease-in-out infinite}
.wt-skeleton i:nth-child(1){width:92%}
.wt-skeleton i:nth-child(2){width:100%}
.wt-skeleton i:nth-child(3){width:63%}

.wt-error{padding:10px 2px 5px;color:var(--dsw-alias-label-primary,#101828)}
.wt-error-title{font-size:12.5px;font-weight:650;line-height:1.4}
.wt-error-text{margin:6px 0 13px;font-size:12px;line-height:1.65;color:var(--dsw-alias-label-secondary,#5f6b7a)}
.wt-retry{display:inline-flex;align-items:center;gap:6px;appearance:none;border:1px solid var(--dsw-alias-border-l2,rgba(16,24,40,.16));border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,#101828);font-size:11.5px;line-height:1.4;padding:6px 10px;cursor:pointer}
.wt-retry:hover{background:var(--dsw-alias-bg-layer-1,rgba(16,24,40,.04))}
.wt-retry:focus-visible{outline:2px solid #4d6bfe;outline-offset:2px}

.wt-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:none;padding:9px 14px 11px;border-top:1px solid var(--dsw-alias-border-l1,rgba(16,24,40,.09));background:var(--dsw-alias-bg-overlay,#fff);color:var(--dsw-alias-label-tertiary,#8b96a8)}
.wt-provider{display:flex;align-items:center;gap:6px;min-width:0;font-size:9.5px;line-height:1.4;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wt-provider-dot{width:5px;height:5px;flex:none;border-radius:50%;background:#2fc7bb;box-shadow:0 0 0 3px rgba(47,199,187,.1)}
.wt-foot-actions{display:flex;align-items:center;gap:3px;flex:none}
.wt-foot-btn{display:grid;place-items:center;width:29px;height:29px;appearance:none;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#5f6b7a);cursor:pointer}
.wt-foot-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-1,rgba(16,24,40,.05));color:var(--dsw-alias-label-primary,#101828)}
.wt-foot-btn:focus-visible{outline:2px solid #4d6bfe;outline-offset:1px}
.wt-foot-btn:disabled{opacity:.32;cursor:default}
.wt-copy{display:inline-flex;align-items:center;gap:5px;appearance:none;border:1px solid rgba(77,107,254,.25);border-radius:9px;background:linear-gradient(135deg,rgba(77,107,254,.11),rgba(45,212,191,.1));color:#3158bf;font-size:11.5px;font-weight:600;line-height:1.4;padding:5px 9px;cursor:pointer;white-space:nowrap}
.wt-copy:hover:not(:disabled){background:linear-gradient(135deg,rgba(77,107,254,.17),rgba(45,212,191,.16))}
.wt-copy:focus-visible{outline:2px solid #4d6bfe;outline-offset:2px}
.wt-copy:disabled{opacity:.38;cursor:default}
.wt-copy-ok{border-color:rgba(34,178,132,.28);color:#168a67;background:rgba(34,178,132,.09)}

.wt-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:5;pointer-events:none;max-width:calc(100vw - 32px);padding:8px 14px;border-radius:999px;border:1px solid rgba(142,238,255,.22);background:linear-gradient(180deg,rgba(9,25,44,.97),rgba(5,15,29,.98));box-shadow:0 16px 36px -12px rgba(2,9,22,.6);color:#e8f6ff;font-size:11.5px;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;animation:wt-toast .2s ease-out}

body[data-ds-dark-theme] .wt-langs{border-color:rgba(174,211,255,.12);background:rgba(255,255,255,.035)}
body[data-ds-dark-theme] .wt-detect-label,body[data-ds-dark-theme] .wt-target,body[data-ds-dark-theme] .wt-result,body[data-ds-dark-theme] .wt-error{color:#eaf3ff}
body[data-ds-dark-theme] .wt-tag{border-color:rgba(119,172,255,.2);background:rgba(92,139,255,.12);color:#a9c8ff}
body[data-ds-dark-theme] .wt-copy{border-color:rgba(126,178,255,.22);background:linear-gradient(135deg,rgba(77,107,254,.17),rgba(45,212,191,.14));color:#bcd6ff}
body[data-ds-dark-theme] .wt-copy-ok{border-color:rgba(94,234,212,.24);background:rgba(34,178,132,.13);color:#7de8c3}
body[data-ds-dark-theme] .wt-panel{background:#0b1728;border-color:rgba(126,178,255,.21)}
body[data-ds-dark-theme] .wt-body,body[data-ds-dark-theme] .wt-foot{background:#0b1728}
body[data-ds-dark-theme] .wt-foot{border-top-color:rgba(174,211,255,.1)}
body[data-ds-dark-theme] .wt-skeleton i{background-image:linear-gradient(90deg,rgba(255,255,255,.07),rgba(255,255,255,.035) 45%,rgba(255,255,255,.07));}

@keyframes wt-splash{from{opacity:0;transform:translateY(5px) scale(.975)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes wt-pop{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes wt-rise{from{opacity:0;transform:translateY(7px) scale(.986)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes wt-toast{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes wt-wave{0%,100%{transform:scaleY(.55);opacity:.55}50%{transform:scaleY(1);opacity:1}}
@keyframes wt-shimmer{0%{background-position:120% 0}100%{background-position:-120% 0}}

@media (max-width:560px){
  .wt-brand-name,.wt-label{display:none}
  .wt-action{padding:8px 7px}
  .wt-divider{margin-right:2px}
  .wt-langs{gap:6px;padding:8px}
  .wt-detect-label{font-size:11.5px}
  .wt-copy{padding:5px 8px}
}
@media (max-width:380px){
  .wt-brand,.wt-divider{display:none}
  .wt-bar{padding:5px 4px}
  .wt-action{padding:8px 6px}
}
@media (prefers-reduced-motion:reduce){
  .wt-bar-wrap,.wt-panel,.wt-more,.wt-toast{animation:none}
  .wt-wave span,.wt-skeleton i{animation:none}
}
`

    // ------------------------------------------------------------- utilities

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max)
    }

    function detectLanguage(text) {
      const han = (text.match(HAN_RE) || []).length
      const latin = (text.match(LATIN_RE) || []).length
      if (han === 0) return 'en'
      if (latin === 0) return 'zh'
      return han >= latin * 0.5 ? 'zh' : 'en'
    }

    function languageName(language) {
      return language === 'zh' ? '中文' : 'English'
    }

    function normalizeSelectedText(text) {
      return String(text).replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ')
    }

    function elementOf(node) {
      if (!node) return null
      if (node.nodeType === 1) return node
      return node.parentElement || null
    }

    function isOurNode(node) {
      const element = elementOf(node)
      return Boolean(element && element.closest('[data-whale-translator]'))
    }

    function isForbiddenSelection(node) {
      const element = elementOf(node)
      if (!element) return true
      if (element.closest('[data-whale-translator]')) return true
      if (element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]')) return true
      if (element.closest('pre, code, kbd, samp')) return true
      return false
    }

    function selectionSnapshot(pointer) {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
      const range = selection.getRangeAt(0)
      if (range.collapsed) return null
      if (isForbiddenSelection(range.startContainer) || isForbiddenSelection(range.endContainer)) return null
      const text = normalizeSelectedText(selection.toString())
      if (text.trim() === '') return null

      let rect
      try {
        rect = range.getBoundingClientRect()
        if ((!rect || (rect.width === 0 && rect.height === 0)) && range.getClientRects().length > 0) {
          rect = range.getClientRects()[0]
        }
      } catch {
        return null
      }
      if (!rect || (rect.width === 0 && rect.height === 0)) return null

      const anchor = {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        x: pointer && Number.isFinite(pointer.x) ? pointer.x : rect.left + rect.width / 2,
      }
      return { text, anchor }
    }

    function barGeometry(anchor) {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const width = Math.max(1, Math.min(BAR_WIDTH, viewportWidth - EDGE * 2))
      const left = clamp(anchor.left + anchor.width / 2 - width / 2, EDGE, Math.max(EDGE, viewportWidth - width - EDGE))
      let top = anchor.top - GAP - BAR_HEIGHT
      let placement = 'above'
      if (top < EDGE) {
        top = anchor.bottom + GAP
        placement = 'below'
      }
      top = clamp(top, EDGE, Math.max(EDGE, viewportHeight - BAR_HEIGHT - EDGE))
      return { left, top, width, placement }
    }

    function panelGeometry(anchor) {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const width = Math.max(1, Math.min(PANEL_WIDTH, viewportWidth - EDGE * 2))
      const center = anchor.left + anchor.width / 2
      const left = clamp(center - width / 2, EDGE, Math.max(EDGE, viewportWidth - width - EDGE))
      let top
      if (anchor.bottom + 12 + 270 < viewportHeight - EDGE) {
        top = anchor.bottom + 12
      } else {
        top = Math.max(EDGE, anchor.top - 12 - PANEL_EST_HEIGHT)
      }
      top = clamp(top, EDGE, Math.max(EDGE, viewportHeight - 220))
      const maxHeight = Math.max(120, viewportHeight - top - EDGE)
      return { left, top, width, maxHeight }
    }

    async function copyToClipboard(text) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text)
          return true
        }
      } catch {
        // Fall through to the selection-based path.
      }
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.top = '-9999px'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const okay = document.execCommand('copy')
        area.remove()
        return Boolean(okay)
      } catch {
        return false
      }
    }

    async function readRouteToken(signal) {
      const fromMeta = document.querySelector('meta[name="whale-translator-token"]')?.getAttribute('content') || ''
      if (fromMeta) return fromMeta
      try {
        const response = await fetch(new URL(ROUTE, document.baseURI).toString(), {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
          signal,
        })
        if (!response.ok) return ''
        const data = await response.json().catch(() => null)
        return data && typeof data.token === 'string' ? data.token : ''
      } catch {
        return ''
      }
    }

    async function requestTranslation(payload, signal) {
      const token = await readRouteToken(signal)
      const response = await fetch(new URL(ROUTE, document.baseURI).toString(), {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(token ? { 'x-whale-translator-token': token } : {}),
        },
        body: JSON.stringify(payload),
        signal,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data || data.ok !== true) {
        const error = new Error((data && data.message) || `翻译服务返回 HTTP ${response.status}。`)
        error.code = data && data.error
        error.status = response.status
        throw error
      }
      return data
    }

    function readableError(error) {
      if (!error) return '翻译失败，请稍后重试。'
      if (error.name === 'AbortError') return ''
      if (error.message && /[\u4e00-\u9fff]/.test(error.message)) return error.message
      if (error.name === 'TypeError' || error.code === 'NETWORK_ERROR') return '连不上翻译服务，请检查网络后重试。'
      return '翻译失败，请稍后重试。'
    }

    function speakableText(text) {
      return text.replace(/\s+/g, ' ').trim().slice(0, 12000)
    }

    function summarySentences(text) {
      const flat = text.replace(/\s+/g, ' ').trim()
      if (!flat) return []
      const matches = flat.match(/[^。！？.!?]+[。！？.!?]+|[^。！？.!?]+$/g)
      if (!matches || matches.length === 0) return [flat]
      return matches
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length >= 8 && sentence.length <= 260)
    }

    function tokensFor(sentence) {
      const tokens = []
      const latin = sentence.toLowerCase().match(/[a-z][a-z'-]{1,}/g) || []
      for (const word of latin) {
        if (!STOPWORDS.has(word) && word.length > 2) tokens.push(word)
      }
      const han = sentence.match(/[\u4e00-\u9fff]{2,}/g) || []
      for (const run of han) {
        for (let index = 0; index + 1 < run.length; index += 1) {
          const pair = run.slice(index, index + 2)
          if (!/[的了着是在和与及或]/.test(pair)) tokens.push(pair)
        }
      }
      return tokens
    }

    /** Small on-device extractive summary; no network and no model call. */
    function summarize(text) {
      const flat = text.replace(/\s+/g, ' ').trim()
      if (flat.length <= 190) return flat
      const sentences = summarySentences(text)
      if (sentences.length <= 2) return sentences.join('\n') || flat.slice(0, 260)
      const frequencies = new Map()
      for (const sentence of sentences) {
        for (const token of tokensFor(sentence)) {
          frequencies.set(token, (frequencies.get(token) || 0) + 1)
        }
      }
      const maxFrequency = Math.max(1, ...frequencies.values())
      const scored = sentences.map((sentence, index) => {
        const tokens = tokensFor(sentence)
        const density = tokens.length > 0
          ? tokens.reduce((sum, token) => sum + (frequencies.get(token) || 0) / maxFrequency, 0) / Math.sqrt(tokens.length)
          : 0
        const position = index === 0 ? 0.22 : index === sentences.length - 1 ? 0.08 : 0
        const lengthPenalty = sentence.length > 190 ? 0.15 : 0
        return { sentence, index, score: density + position - lengthPenalty }
      })
      const count = Math.min(3, Math.max(2, Math.round(sentences.length / 3)))
      const picked = scored
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .sort((a, b) => a.index - b.index)
      return picked.map((entry) => entry.sentence).join('\n')
    }

    // ----------------------------------------------------------------- icon

    const WHALE_BODY = 'M6 9.7 3.9 8.4C2.7 7.7 2 6.4 2 5V3c2 0 4 2 4 2s2-2 4-2v2c0 1.4-.7 2.7-1.9 3.4l-3.8 2.4A5 5 0 0 0 7 20h12c1.7 0 3-1.3 3-3v-3c0-2.8-2.2-5-5-5-2.7 0-5.1 1.4-6.4 3.6L9.7 14A2 2 0 0 1 6 13Z'
    const WHALE_SPOUT = 'M18 9.1V5a2 2 0 0 0-4 0M18 5a2 2 0 0 1 4 0'

    function WhaleMark(props) {
      const size = props && props.size ? props.size : 18
      return h(
        'svg',
        {
          className: props && props.className,
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          strokeWidth: props && props.strokeWidth ? props.strokeWidth : 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        h('path', { d: WHALE_BODY, stroke: 'currentColor' }),
        h('path', { d: WHALE_SPOUT, stroke: 'var(--wt-accent,#8eeeff)' }),
        h('circle', { cx: '15', cy: '15', r: '0.68', fill: 'currentColor' }),
      )
    }

    function Icon(props) {
      const size = props && props.size ? props.size : 15
      const common = {
        width: size,
        height: size,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.45,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      }
      const name = props && props.name
      if (name === 'search') {
        return h('svg', common, h('circle', { cx: '7', cy: '7', r: '4.2' }), h('path', { d: 'm10.2 10.2 3.8 3.8' }))
      }
      if (name === 'copy') {
        return h(
          'svg',
          common,
          h('rect', { x: '5.2', y: '5.2', width: '8', height: '8', rx: '2' }),
          h('path', { d: 'M10.8 5.2V4.2A2 2 0 0 0 8.8 2.2H4.2a2 2 0 0 0-2 2v4.6a2 2 0 0 0 2 2h1' }),
        )
      }
      if (name === 'translate') {
        return h(
          'svg',
          common,
          h('path', { d: 'M2.2 4.2h6.1M5.25 2.4v1.8c0 3-1.7 5.5-4 6.7' }),
          h('path', { d: 'M3.2 7.1c1 1.8 2.8 3.1 5 3.8' }),
          h('path', { d: 'm9.1 13.4 2.2-6.4 2.2 6.4M10 11.4h2.7' }),
        )
      }
      if (name === 'speaker') {
        return h(
          'svg',
          common,
          h('path', { d: 'M2 6.1v3.8h2.3L7.8 13V3L4.3 6.1H2Z' }),
          h('path', { d: 'M10.1 5.3a3.7 3.7 0 0 1 0 5.4M12 3.4a6.2 6.2 0 0 1 0 9.2' }),
        )
      }
      if (name === 'stop') {
        return h('svg', common, h('rect', { x: '4.5', y: '4.5', width: '7', height: '7', rx: '1.7', fill: 'currentColor', stroke: 'none' }))
      }
      if (name === 'summary') {
        return h(
          'svg',
          common,
          h('rect', { x: '2.8', y: '2.2', width: '10.4', height: '11.6', rx: '2' }),
          h('path', { d: 'M5.4 5.8h5.2M5.4 8h3.6M5.4 10.2h4.4' }),
        )
      }
      if (name === 'more') {
        return h(
          'svg',
          common,
          h('circle', { cx: '3.4', cy: '8', r: '1', fill: 'currentColor', stroke: 'none' }),
          h('circle', { cx: '8', cy: '8', r: '1', fill: 'currentColor', stroke: 'none' }),
          h('circle', { cx: '12.6', cy: '8', r: '1', fill: 'currentColor', stroke: 'none' }),
        )
      }
      if (name === 'close') {
        return h('svg', common, h('path', { d: 'm4 4 8 8M12 4l-8 8' }))
      }
      if (name === 'back') {
        return h('svg', common, h('path', { d: 'm9.8 3.2-4.6 4.8 4.6 4.8' }))
      }
      if (name === 'chevron') {
        return h('svg', common, h('path', { d: 'm4 6 4 4 4-4' }))
      }
      if (name === 'check') {
        return h('svg', common, h('path', { d: 'm3.2 8.4 3 3 6.6-7.2' }))
      }
      if (name === 'refresh') {
        return h(
          'svg',
          common,
          h('path', { d: 'M13.1 6.2A5.4 5.4 0 1 0 13 10' }),
          h('path', { d: 'M13.3 2.8v3.6H9.7' }),
        )
      }
      if (name === 'flow') {
        return h(
          'svg',
          common,
          h('path', { d: 'M2.4 8h10.2M9.3 4.6 12.8 8l-3.5 3.4' }),
        )
      }
      return null
    }

    // -------------------------------------------------------------- component

    function WhaleOverlay() {
      const [view, setView] = React.useState(null)
      const [toast, setToast] = React.useState('')
      const [copied, setCopied] = React.useState(false)
      const viewRef = React.useRef(null)
      const panelRef = React.useRef(null)
      const abortRef = React.useRef(null)
      const requestSeq = React.useRef(0)
      const selectionTimer = React.useRef(0)
      const toastTimer = React.useRef(0)
      const copyTimer = React.useRef(0)
      const speechSeq = React.useRef(0)
      const pointerDown = React.useRef(null)
      const dismissedRef = React.useRef(null)

      viewRef.current = view

      const showToast = React.useCallback((message) => {
        window.clearTimeout(toastTimer.current)
        setToast(message)
        toastTimer.current = window.setTimeout(() => setToast(''), 1900)
      }, [])

      const clearCopied = React.useCallback(() => {
        window.clearTimeout(copyTimer.current)
        setCopied(false)
      }, [])

      const stopSpeech = React.useCallback(() => {
        speechSeq.current += 1
        try {
          if (window.speechSynthesis) window.speechSynthesis.cancel()
        } catch {
          // Speech synthesis is optional.
        }
      }, [])

      const close = React.useCallback(() => {
        const current = viewRef.current
        if (current) dismissedRef.current = { text: current.text }
        requestSeq.current += 1
        if (abortRef.current) {
          abortRef.current.abort()
          abortRef.current = null
        }
        stopSpeech()
        clearCopied()
        setView(null)
      }, [clearCopied, stopSpeech])

      const openBar = React.useCallback((snapshot) => {
        dismissedRef.current = null
        if (abortRef.current) {
          abortRef.current.abort()
          abortRef.current = null
        }
        stopSpeech()
        clearCopied()
        const detected = detectLanguage(snapshot.text)
        const target = detected === 'zh' ? 'en' : 'zh'
        setView({
          phase: 'bar',
          text: snapshot.text,
          anchor: snapshot.anchor,
          bar: barGeometry(snapshot.anchor),
          panel: null,
          detected,
          target,
          targetMode: 'auto',
          status: 'idle',
          result: '',
          summary: '',
          error: '',
          provider: 'bing',
          more: false,
          speaking: false,
        })
      }, [clearCopied, stopSpeech])

      const scheduleSelection = React.useCallback((pointer, delay) => {
        window.clearTimeout(selectionTimer.current)
        selectionTimer.current = window.setTimeout(() => {
          const snapshot = selectionSnapshot(pointer)
          if (!snapshot) return
          const current = viewRef.current
          if (current && current.text === snapshot.text) return
          const dismissed = dismissedRef.current
          if (dismissed && dismissed.text === snapshot.text) return
          openBar(snapshot)
        }, delay == null ? 0 : delay)
      }, [openBar])

      const beginTranslation = React.useCallback((targetMode) => {
        const current = viewRef.current
        if (!current) return
        const seq = requestSeq.current + 1
        requestSeq.current = seq
        if (abortRef.current) abortRef.current.abort()
        const controller = new AbortController()
        abortRef.current = controller
        clearCopied()

        const predicted = current.detected === 'zh' ? 'en' : 'zh'
        const shownTarget = targetMode === 'auto' ? predicted : targetMode
        setView((previous) => previous ? {
          ...previous,
          phase: 'panel',
          panel: panelGeometry(previous.anchor),
          targetMode,
          target: shownTarget,
          status: 'loading',
          result: '',
          summary: '',
          error: '',
          more: false,
        } : previous)

        if (current.text.length > MAX_TEXT) {
          setView((previous) => previous ? {
            ...previous,
            status: 'error',
            error: `一次最多翻译 ${MAX_TEXT} 个字符，请缩短选区。`,
          } : previous)
          abortRef.current = null
          return
        }

        const timeout = window.setTimeout(() => {
          if (requestSeq.current !== seq) return
          controller.abort()
          setView((previous) => previous ? {
            ...previous,
            status: 'error',
            error: '翻译超时，请重试。',
          } : previous)
        }, 15000)

        void requestTranslation({ text: current.text, source: 'auto', target: targetMode }, controller.signal)
          .then((data) => {
            if (requestSeq.current !== seq) return
            setView((previous) => previous ? {
              ...previous,
              phase: 'panel',
              status: 'done',
              result: data.translation,
              detected: data.source === 'zh' || data.source === 'en' ? data.source : previous.detected,
              target: data.target === 'zh' || data.target === 'en' ? data.target : previous.target,
              provider: data.provider === 'google' ? 'google' : data.provider === 'mymemory' ? 'mymemory' : 'bing',
              panel: panelGeometry(previous.anchor),
            } : previous)
          })
          .catch((error) => {
            if (requestSeq.current !== seq || controller.signal.aborted) return
            const message = readableError(error)
            if (!message) return
            setView((previous) => previous ? {
              ...previous,
              status: 'error',
              error: message,
            } : previous)
          })
          .finally(() => {
            window.clearTimeout(timeout)
            if (abortRef.current === controller) abortRef.current = null
          })
      }, [clearCopied])

      const changeTarget = React.useCallback((nextTarget) => {
        const current = viewRef.current
        if (!current) return
        if (nextTarget === current.detected) {
          const message = nextTarget === 'zh' ? '原文已经是中文。换 English 试试。' : '原文已经是英文。换中文试试。'
          setView((previous) => previous ? { ...previous, target: nextTarget, targetMode: nextTarget, status: 'error', result: '', error: message } : previous)
          return
        }
        beginTranslation(nextTarget)
      }, [beginTranslation])

      const copy = React.useCallback(async (text, message) => {
        const okay = await copyToClipboard(text)
        showToast(okay ? (message || '已复制') : '复制失败，请手动选择文字。')
        if (okay) {
          setCopied(true)
          window.clearTimeout(copyTimer.current)
          copyTimer.current = window.setTimeout(() => setCopied(false), 1500)
        }
        return okay
      }, [showToast])

      const readAloud = React.useCallback((text, language) => {
        const current = viewRef.current
        if (!current) return
        if (current.speaking) {
          stopSpeech()
          setView((previous) => previous ? { ...previous, speaking: false } : previous)
          return
        }
        if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
          showToast('当前环境不支持朗读')
          return
        }
        const clean = speakableText(text)
        if (!clean) return
        stopSpeech()
        const seq = speechSeq.current + 1
        speechSeq.current = seq
        const utterance = new window.SpeechSynthesisUtterance(clean)
        utterance.lang = language === 'zh' ? 'zh-CN' : 'en-US'
        utterance.rate = 0.98
        utterance.pitch = 1
        utterance.onend = () => {
          if (speechSeq.current === seq) {
            setView((previous) => previous ? { ...previous, speaking: false } : previous)
          }
        }
        utterance.onerror = () => {
          if (speechSeq.current === seq) {
            setView((previous) => previous ? { ...previous, speaking: false } : previous)
          }
        }
        try {
          window.speechSynthesis.cancel()
          window.speechSynthesis.speak(utterance)
          window.speechSynthesis.resume()
          setView((previous) => previous ? { ...previous, speaking: true } : previous)
        } catch {
          showToast('朗读启动失败')
        }
      }, [showToast, stopSpeech])

      const openSearch = React.useCallback(() => {
        const current = viewRef.current
        if (!current) return
        let opened = null
        try {
          opened = window.open(`https://www.bing.com/search?q=${encodeURIComponent(current.text)}`, '_blank', 'noopener,noreferrer')
        } catch {
          opened = null
        }
        if (!opened) {
          void copy(current.text, '已复制，可粘贴到搜索框')
        }
        close()
      }, [close, copy])

      const openSummary = React.useCallback(() => {
        const current = viewRef.current
        if (!current) return
        if (abortRef.current) {
          abortRef.current.abort()
          abortRef.current = null
        }
        requestSeq.current += 1
        clearCopied()
        const summary = summarize(current.text)
        setView((previous) => previous ? {
          ...previous,
          phase: 'summary',
          panel: panelGeometry(previous.anchor),
          summary,
          status: 'done',
          result: '',
          error: '',
          more: false,
        } : previous)
      }, [clearCopied])

      const backToBar = React.useCallback(() => {
        requestSeq.current += 1
        if (abortRef.current) {
          abortRef.current.abort()
          abortRef.current = null
        }
        stopSpeech()
        clearCopied()
        setView((previous) => previous ? {
          ...previous,
          phase: 'bar',
          panel: null,
          status: 'idle',
          result: '',
          summary: '',
          error: '',
          more: false,
          speaking: false,
        } : previous)
      }, [clearCopied, stopSpeech])

      React.useEffect(() => {
        const onMouseUp = (event) => {
          if (event.button !== 0) return
          if (isOurNode(event.target)) return
          const down = pointerDown.current
          pointerDown.current = null
          const selection = window.getSelection()
          const currentText = selection ? normalizeSelectedText(selection.toString()) : ''
          const dragged = Boolean(down) && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4
          if (currentText.trim() === '') return
          if (down && currentText === down.text && !dragged) return
          scheduleSelection({ x: event.clientX, y: event.clientY }, 0)
        }
        const onMouseDown = (event) => {
          if (isOurNode(event.target)) return
          if (viewRef.current) close()
          dismissedRef.current = null
          if (event.button !== 0) {
            pointerDown.current = null
            return
          }
          const selection = window.getSelection()
          pointerDown.current = {
            x: event.clientX,
            y: event.clientY,
            text: selection ? normalizeSelectedText(selection.toString()) : '',
          }
        }
        const onKeyDown = (event) => {
          if (event.key !== 'Escape' || !viewRef.current) return
          event.preventDefault()
          close()
        }
        const onKeyUp = (event) => {
          if (isOurNode(event.target)) return
          if (event.shiftKey) scheduleSelection(null, 130)
        }
        const onSelectionChange = () => {
          if (pointerDown.current) return
          const selection = window.getSelection()
          if (!selection || selection.isCollapsed || selection.rangeCount === 0) return
          scheduleSelection(null, 180)
        }
        const onTouchEnd = (event) => {
          if (isOurNode(event.target)) return
          const touch = event.changedTouches && event.changedTouches[0]
          scheduleSelection(touch ? { x: touch.clientX, y: touch.clientY } : null, 160)
        }
        const onScroll = () => {
          if (viewRef.current && viewRef.current.phase === 'bar') close()
        }
        const onResize = () => {
          if (viewRef.current) close()
        }
        const onWindowBlur = () => {
          pointerDown.current = null
        }
        document.addEventListener('mouseup', onMouseUp, true)
        document.addEventListener('mousedown', onMouseDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        document.addEventListener('keyup', onKeyUp, true)
        document.addEventListener('selectionchange', onSelectionChange)
        document.addEventListener('touchend', onTouchEnd, true)
        window.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', onResize)
        window.addEventListener('blur', onWindowBlur)
        return () => {
          window.clearTimeout(selectionTimer.current)
          document.removeEventListener('mouseup', onMouseUp, true)
          document.removeEventListener('mousedown', onMouseDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
          document.removeEventListener('keyup', onKeyUp, true)
          document.removeEventListener('selectionchange', onSelectionChange)
          document.removeEventListener('touchend', onTouchEnd, true)
          window.removeEventListener('scroll', onScroll, true)
          window.removeEventListener('resize', onResize)
          window.removeEventListener('blur', onWindowBlur)
          if (abortRef.current) abortRef.current.abort()
          stopSpeech()
          window.clearTimeout(toastTimer.current)
          window.clearTimeout(copyTimer.current)
        }
      }, [close, scheduleSelection, stopSpeech])

      React.useEffect(() => {
        if (!view || (view.phase !== 'panel' && view.phase !== 'summary')) return
        const node = panelRef.current
        if (!node) return
        const frame = window.requestAnimationFrame(() => {
          try {
            node.focus({ preventScroll: true })
          } catch {
            node.focus()
          }
        })
        return () => window.cancelAnimationFrame(frame)
      }, [view && view.phase])

      if (!view) {
        return h(
          React.Fragment,
          null,
          h('style', { key: 'wt-css' }, CSS),
          h('div', { className: 'wt-root', 'data-whale-translator': 'root' },
            toast ? h('div', { className: 'wt-toast', role: 'status', 'aria-live': 'polite' }, toast) : null,
          ),
        )
      }

      const isPanel = view.phase === 'panel'
      const isSummary = view.phase === 'summary'
      const isBusy = view.status === 'loading'
      const canCopy = isSummary ? Boolean(view.summary) : Boolean(view.result)
      const speechLanguage = isSummary ? view.detected : (view.target === 'zh' ? 'zh' : 'en')
      const moreUp = view.phase === 'bar' && view.bar.top + BAR_HEIGHT + 190 > window.innerHeight

      const action = (name, label, onClick, options) => h(
        'button',
        {
          type: 'button',
          className: `wt-action${options && options.live ? ' wt-action-live' : ''}`,
          title: options && options.title ? options.title : label,
          'aria-label': label,
          onClick,
        },
        h(Icon, { name, size: 15 }),
        h('span', { className: 'wt-label' }, label),
      )

      const toolbar = view.phase === 'bar' ? h(
        'div',
        {
          className: 'wt-bar-wrap',
          style: { left: view.bar.left + 'px', top: view.bar.top + 'px', width: view.bar.width + 'px' },
        },
        h(
          'div',
          { className: 'wt-bar', role: 'toolbar', 'aria-label': '选中文字操作' },
          h('span', { className: 'wt-brand', title: '鲸译 · Whale Mode' },
            h('span', { className: 'wt-orb' }, h(WhaleMark, { size: 17 })),
            h('span', { className: 'wt-brand-name' }, '鲸译'),
          ),
          h('span', { className: 'wt-divider' }),
          h(
            'div',
            { className: 'wt-actions' },
            action('search', 'AI 搜索', openSearch, { title: '在 Bing 中搜索选中文字' }),
            action('copy', '复制', () => void copy(view.text, '已复制原文')),
            action('translate', '翻译', () => beginTranslation('auto'), { title: '翻译（选中文字会发送至翻译服务）' }),
            action(view.speaking ? 'stop' : 'speaker', view.speaking ? '停止' : '朗读', () => readAloud(view.text, view.detected), { live: view.speaking }),
            action('summary', '总结', openSummary),
            h('span', { className: 'wt-sep' }),
            action('more', '更多', () => setView((previous) => previous ? { ...previous, more: !previous.more } : previous)),
          ),
        ),
        view.more ? h(
          'div',
          { className: `wt-more${moreUp ? ' wt-more-up' : ''}`, role: 'menu', 'aria-label': '更多操作' },
          h('button', { type: 'button', className: 'wt-more-item', role: 'menuitem', onClick: () => void copy(view.text, '已复制原文') },
            h(Icon, { name: 'copy', size: 14 }), '复制原文'),
          view.result ? h('button', { type: 'button', className: 'wt-more-item', role: 'menuitem', onClick: () => void copy(view.result, '已复制译文') },
            h(Icon, { name: 'translate', size: 14 }), '复制译文') : null,
          h('button', { type: 'button', className: 'wt-more-item', role: 'menuitem', onClick: () => beginTranslation('auto') },
            h(Icon, { name: 'refresh', size: 14 }), '重新翻译'),
          h('button', { type: 'button', className: 'wt-more-item wt-more-item-danger', role: 'menuitem', onClick: close },
            h(Icon, { name: 'close', size: 14 }), '关闭工具栏'),
        ) : null,
      ) : null

      const content = isSummary
        ? h('div', { className: 'wt-content' },
            h('div', { className: 'wt-result wt-result-summary', 'aria-live': 'polite' }, view.summary || view.text),
          )
        : view.status === 'loading'
          ? h('div', { className: 'wt-content' },
              h('div', { className: 'wt-loading', role: 'status', 'aria-live': 'polite' },
                h('div', { className: 'wt-loading-line' },
                  h('span', { className: 'wt-wave', 'aria-hidden': 'true' }, h('span', { key: 'a' }), h('span', { key: 'b' }), h('span', { key: 'c' })),
                  h('span', null, '正在翻译…'),
                ),
                h('div', { className: 'wt-skeleton', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
              ),
            )
          : view.status === 'error'
            ? h('div', { className: 'wt-content' },
                h('div', { className: 'wt-error', role: 'alert' },
                  h('div', { className: 'wt-error-title' }, '翻译没有完成'),
                  h('div', { className: 'wt-error-text' }, view.error),
                  h('button', { type: 'button', className: 'wt-retry', onClick: () => beginTranslation(view.targetMode || 'auto') },
                    h(Icon, { name: 'refresh', size: 13 }), '重试'),
                ),
              )
            : h('div', { className: 'wt-content' },
                h('div', { className: 'wt-result', 'aria-live': 'polite' }, view.result),
              )

      const panel = isPanel || isSummary ? h(
        'section',
        {
          ref: panelRef,
          className: 'wt-panel',
          style: {
            left: view.panel.left + 'px',
            top: view.panel.top + 'px',
            width: view.panel.width + 'px',
            maxHeight: view.panel.maxHeight + 'px',
          },
          role: 'dialog',
          'aria-label': isSummary ? '鲸语摘要' : '鲸译翻译',
          tabIndex: -1,
        },
        h(
          'header',
          { className: 'wt-head' },
          h('span', { className: 'wt-head-orb' }, h(WhaleMark, { size: 24 })),
          h('div', { className: 'wt-head-copy' },
            h('div', { className: 'wt-head-title' }, isSummary ? '鲸语摘要' : '鲸译'),
            h('div', { className: 'wt-head-sub' }, isSummary ? 'SUMMARY · 本地抽取' : 'WHALE MODE · 英汉互译'),
          ),
          h('div', { className: 'wt-head-actions' },
            h('button', { type: 'button', className: 'wt-icon-btn', title: '返回操作栏', 'aria-label': '返回操作栏', onClick: backToBar }, h(Icon, { name: 'back', size: 16 })),
            h('button', { type: 'button', className: 'wt-icon-btn', title: '关闭', 'aria-label': '关闭', onClick: close }, h(Icon, { name: 'close', size: 16 })),
          ),
        ),
        h(
          'div',
          { className: 'wt-body' },
          !isSummary ? h(
            'div',
            { className: 'wt-langs' },
            h('span', { className: 'wt-detect' },
              h('span', { className: 'wt-dot', 'aria-hidden': 'true' }),
              h('span', { className: 'wt-detect-label' }, '自动检测'),
              h('span', { className: 'wt-tag', title: '识别到的原文语言' }, languageName(view.detected)),
            ),
            h('span', { className: 'wt-flow', 'aria-hidden': 'true' }, h(Icon, { name: 'flow', size: 16 })),
            h('span', { className: 'wt-target-col' },
              h('span', { className: 'wt-target-wrap' },
                h('select', {
                  className: 'wt-target',
                  value: view.target,
                  'aria-label': '译为',
                  onChange: (event) => changeTarget(event.target.value),
                },
                  h('option', { value: 'zh', disabled: view.detected === 'zh' }, '中文（简体）'),
                  h('option', { value: 'en', disabled: view.detected === 'en' }, 'English'),
                ),
                h('span', { className: 'wt-chevron', 'aria-hidden': 'true' }, h(Icon, { name: 'chevron', size: 14 })),
              ),
            ),
          ) : null,
          content,
          h(WhaleMark, { className: 'wt-watermark', size: 168, strokeWidth: 0.42 }),
        ),
        h(
          'footer',
          { className: 'wt-foot' },
          h('span', { className: 'wt-provider' },
            h('span', { className: 'wt-provider-dot', 'aria-hidden': 'true' }),
            isSummary
              ? '本地摘要 · 不联网'
              : isBusy
                ? '正在翻译'
                : view.status === 'error'
                  ? '翻译未完成'
                  : view.provider === 'google'
                    ? 'Google · 翻译'
                    : 'Bing · 翻译',
          ),
          h('div', { className: 'wt-foot-actions' },
            isPanel && !isBusy && view.result ? h('button', {
              type: 'button',
              className: 'wt-foot-btn',
              title: '重新翻译',
              'aria-label': '重新翻译',
              onClick: () => beginTranslation(view.targetMode || 'auto'),
            }, h(Icon, { name: 'refresh', size: 14 })) : null,
            h('button', {
              type: 'button',
              className: 'wt-foot-btn',
              title: view.speaking ? '停止朗读' : (isSummary ? '朗读摘要' : '朗读译文'),
              'aria-label': view.speaking ? '停止朗读' : (isSummary ? '朗读摘要' : '朗读译文'),
              disabled: !canCopy,
              onClick: () => readAloud(canCopy ? (isSummary ? view.summary : view.result) : '', speechLanguage),
            }, h(Icon, { name: view.speaking ? 'stop' : 'speaker', size: 14 })),
            h('button', {
              type: 'button',
              className: `wt-copy${copied ? ' wt-copy-ok' : ''}`,
              disabled: !canCopy,
              onClick: () => void copy(canCopy ? (isSummary ? view.summary : view.result) : '', isSummary ? '已复制摘要' : '已复制译文'),
            },
              h(Icon, { name: copied ? 'check' : 'copy', size: 13 }),
              copied ? '已复制' : (isSummary ? '复制摘要' : '复制译文'),
            ),
          ),
        ),
      ) : null

      return h(
        React.Fragment,
        null,
        h('style', { key: 'wt-css' }, CSS),
        h(
          'div',
          { className: 'wt-root', 'data-whale-translator': 'root' },
          toolbar,
          panel,
          toast ? h('div', { className: 'wt-toast', role: 'status', 'aria-live': 'polite' }, toast) : null,
        ),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'whale-translator.overlay',
          order: 45,
        }, WhaleOverlay))
      },
    }
  },
})
