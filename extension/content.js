/**
 * Standalone browser-extension content script.
 *
 * It runs in every frame (including cross-origin frames when the extension has
 * host access), renders the whale toolbar in a fixed page overlay, and sends
 * translation requests to the MV3 service worker.
 */
;(() => {
  const HOST_ID = 'whale-translator-extension-root'
  if (window.__whaleTranslatorExtension) return
  window.__whaleTranslatorExtension = true
  if (!(document.documentElement instanceof HTMLElement)) return

  const MAX_TEXT = 12_000
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
    'she', 'use', 'than', 'then', 'them', 'these', 'they', 'this', 'that',
    'with', 'have', 'from', 'were', 'will', 'would', 'there', 'their', 'what',
    'when', 'where', 'which', 'while', 'about', 'after', 'again', 'also', 'into',
    'more', 'most', 'other', 'some', 'such', 'only', 'over', 'very', 'just',
  ])

  const WHALE_BODY = 'M6 9.7 3.9 8.4C2.7 7.7 2 6.4 2 5V3c2 0 4 2 4 2s2-2 4-2v2c0 1.4-.7 2.7-1.9 3.4l-3.8 2.4A5 5 0 0 0 7 20h12c1.7 0 3-1.3 3-3v-3c0-2.8-2.2-5-5-5-2.7 0-5.1 1.4-6.4 3.6L9.7 14A2 2 0 0 1 6 13Z'
  const WHALE_SPOUT = 'M18 9.1V5a2 2 0 0 0-4 0M18 5a2 2 0 0 1 4 0'

  const ICONS = {
    search: '<circle cx="7" cy="7" r="4.2"/><path d="m10.2 10.2 3.8 3.8"/>',
    copy: '<rect x="5.2" y="5.2" width="8" height="8" rx="2"/><path d="M10.8 5.2V4.2A2 2 0 0 0 8.8 2.2H4.2a2 2 0 0 0-2 2v4.6a2 2 0 0 0 2 2h1"/>',
    translate: '<path d="M2.2 4.2h6.1M5.25 2.4v1.8c0 3-1.7 5.5-4 6.7"/><path d="M3.2 7.1c1 1.8 2.8 3.1 5 3.8"/><path d="m9.1 13.4 2.2-6.4 2.2 6.4M10 11.4h2.7"/>',
    speaker: '<path d="M2 6.1v3.8h2.3L7.8 13V3L4.3 6.1H2Z"/><path d="M10.1 5.3a3.7 3.7 0 0 1 0 5.4M12 3.4a6.2 6.2 0 0 1 0 9.2"/>',
    stop: '<rect x="4.5" y="4.5" width="7" height="7" rx="1.7" fill="currentColor" stroke="none"/>',
    summary: '<rect x="2.8" y="2.2" width="10.4" height="11.6" rx="2"/><path d="M5.4 5.8h5.2M5.4 8h3.6M5.4 10.2h4.4"/>',
    more: '<circle cx="3.4" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="12.6" cy="8" r="1" fill="currentColor" stroke="none"/>',
    close: '<path d="m4 4 8 8M12 4l-8 8"/>',
    back: '<path d="m9.8 3.2-4.6 4.8 4.6 4.8"/>',
    chevron: '<path d="m4 6 4 4 4-4"/>',
    check: '<path d="m3.2 8.4 3 3 6.6-7.2"/>',
    refresh: '<path d="M13.1 6.2A5.4 5.4 0 1 0 13 10"/><path d="M13.3 2.8v3.6H9.7"/>',
    flow: '<path d="M2.4 8h10.2M9.3 4.6 12.8 8l-3.5 3.4"/>',
  }

  function icon(name, size = 15) {
    const body = ICONS[name] || ''
    return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`
  }

  function whale(size = 18, strokeWidth = 1.7) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${WHALE_BODY}" stroke="currentColor"/><path d="${WHALE_SPOUT}" stroke="#8eeeff"/><circle cx="15" cy="15" r="0.68" fill="currentColor"/></svg>`
  }

  const BAR_MARKUP = `
    <div class="wt-bar-wrap" hidden>
      <div class="wt-bar" role="toolbar" aria-label="选中文字操作">
        <span class="wt-brand" title="鲸译 · Whale Mode">
          <span class="wt-orb">${whale(17)}</span>
          <span class="wt-brand-name">鲸译</span>
        </span>
        <span class="wt-divider"></span>
        <div class="wt-actions">
          <button type="button" class="wt-action" data-act="search" title="在 Bing 中搜索选中文字" aria-label="AI 搜索">${icon('search')}<span class="wt-label">AI 搜索</span></button>
          <button type="button" class="wt-action" data-act="copy-source" title="复制" aria-label="复制">${icon('copy')}<span class="wt-label">复制</span></button>
          <button type="button" class="wt-action" data-act="translate" title="翻译（选中文字会发送至翻译服务）" aria-label="翻译">${icon('translate')}<span class="wt-label">翻译</span></button>
          <button type="button" class="wt-action" data-act="speak-source" title="朗读" aria-label="朗读"><span data-ref="speak-icon">${icon('speaker')}</span><span class="wt-label" data-ref="speak-label">朗读</span></button>
          <button type="button" class="wt-action" data-act="summary" title="总结" aria-label="总结">${icon('summary')}<span class="wt-label">总结</span></button>
          <span class="wt-sep"></span>
          <button type="button" class="wt-action" data-act="more" title="更多" aria-label="更多">${icon('more')}<span class="wt-label">更多</span></button>
        </div>
      </div>
      <div class="wt-more" role="menu" aria-label="更多操作" hidden>
        <button type="button" class="wt-more-item" role="menuitem" data-act="copy-source">${icon('copy', 14)}复制原文</button>
        <button type="button" class="wt-more-item" role="menuitem" data-act="copy-result" data-ref="more-copy" hidden>${icon('translate', 14)}复制译文</button>
        <button type="button" class="wt-more-item wt-more-item-danger" role="menuitem" data-act="close">${icon('close', 14)}关闭工具栏</button>
      </div>
    </div>
  `

  const PANEL_MARKUP = `
    <section class="wt-panel" role="dialog" aria-label="鲸译翻译" tabindex="-1" hidden>
      <header class="wt-head">
        <span class="wt-head-orb">${whale(24)}</span>
        <div class="wt-head-copy">
          <div class="wt-head-title" data-ref="title">鲸译</div>
          <div class="wt-head-sub" data-ref="subtitle">WHALE MODE · 英汉互译</div>
        </div>
        <div class="wt-head-actions">
          <button type="button" class="wt-icon-btn" data-act="back" title="返回操作栏" aria-label="返回操作栏">${icon('back', 16)}</button>
          <button type="button" class="wt-icon-btn" data-act="close" title="关闭" aria-label="关闭">${icon('close', 16)}</button>
        </div>
      </header>
      <div class="wt-body">
        <div class="wt-langs" data-ref="langs">
          <span class="wt-detect">
            <span class="wt-dot" aria-hidden="true"></span>
            <span class="wt-detect-label">自动检测</span>
            <span class="wt-tag" data-ref="detected" title="识别到的原文语言">English</span>
          </span>
          <span class="wt-flow" aria-hidden="true">${icon('flow', 16)}</span>
          <span class="wt-target-col">
            <span class="wt-target-wrap">
              <select class="wt-target" data-ref="target" aria-label="译为">
                <option value="zh">中文（简体）</option>
                <option value="en">English</option>
              </select>
              <span class="wt-chevron" aria-hidden="true">${icon('chevron', 14)}</span>
            </span>
          </span>
        </div>
        <div class="wt-content" data-ref="content"></div>
        <span class="wt-watermark" data-ref="watermark">${whale(168, 0.42)}</span>
      </div>
      <footer class="wt-foot">
        <span class="wt-provider">
          <span class="wt-provider-dot" aria-hidden="true"></span>
          <span data-ref="provider">Bing · 翻译</span>
        </span>
        <div class="wt-foot-actions">
          <button type="button" class="wt-foot-btn" data-act="read-result" title="朗读译文" aria-label="朗读译文" disabled>${icon('speaker', 14)}</button>
          <button type="button" class="wt-copy" data-act="copy-result" disabled>${icon('copy', 13)}<span data-ref="copy-label">复制译文</span></button>
        </div>
      </footer>
    </section>
  `

  const TOAST_MARKUP = '<div class="wt-toast" role="status" aria-live="polite" hidden></div>'

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
    return scored
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .sort((a, b) => a.index - b.index)
      .map((entry) => entry.sentence)
      .join('\n')
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

  function barGeometry(anchor) {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const width = Math.max(1, Math.min(BAR_WIDTH, viewportWidth - EDGE * 2))
    const left = clamp(anchor.left + anchor.width / 2 - width / 2, EDGE, Math.max(EDGE, viewportWidth - width - EDGE))
    let top = anchor.top - GAP - BAR_HEIGHT
    if (top < EDGE) top = anchor.bottom + GAP
    top = clamp(top, EDGE, Math.max(EDGE, viewportHeight - BAR_HEIGHT - EDGE))
    return { left, top, width }
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

  function readableError(error) {
    if (!error) return '翻译失败，请稍后重试。'
    if (error.name === 'AbortError') return ''
    if (error.message && /[\u4e00-\u9fff]/.test(error.message)) return error.message
    if (error.name === 'TypeError') return '连不上翻译服务，请检查网络后重试。'
    return '翻译失败，请稍后重试。'
  }

  function speakableText(text) {
    return text.replace(/\s+/g, ' ').trim().slice(0, 12_000)
  }

  async function boot() {
    const host = document.createElement('div')
    host.id = HOST_ID
    host.className = 'wt-root'
    host.setAttribute('data-whale-translator', 'host')
    host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:auto;display:none;'
    host.innerHTML = BAR_MARKUP + PANEL_MARKUP + TOAST_MARKUP

    const root = host

    const barWrap = root.querySelector('.wt-bar-wrap')
    const more = root.querySelector('.wt-more')
    const panel = root.querySelector('.wt-panel')
    const content = root.querySelector('[data-ref="content"]')
    const title = root.querySelector('[data-ref="title"]')
    const subtitle = root.querySelector('[data-ref="subtitle"]')
    const detectedTag = root.querySelector('[data-ref="detected"]')
    const langs = root.querySelector('[data-ref="langs"]')
    const targetSelect = root.querySelector('[data-ref="target"]')
    const provider = root.querySelector('[data-ref="provider"]')
    const readBtn = panel.querySelector('[data-act="read-result"]')
    const copyBtn = panel.querySelector('[data-act="copy-result"]')
    const copyLabel = panel.querySelector('[data-ref="copy-label"]')
    const speakIcon = root.querySelector('[data-ref="speak-icon"]')
    const speakLabel = root.querySelector('[data-ref="speak-label"]')
    const moreCopy = root.querySelector('[data-ref="more-copy"]')
    const toast = root.querySelector('.wt-toast')

    let state = null
    let requestSeq = 0
    let abortRequest = null
    let selectionTimer = 0
    let toastTimer = 0
    let copyTimer = 0
    let speechSeq = 0
    let pointerDown = null
    let dismissed = null
    let copied = false
    let warmedAt = 0

    function isOurNode(node) {
      if (!node) return false
      const element = node.nodeType === 1 ? node : node.parentElement
      return Boolean(element && (element === host || host.contains(element)))
    }

    function isForbidden(node) {
      const element = node && node.nodeType === 1 ? node : node && node.parentElement
      if (!element) return true
      if (isOurNode(element)) return true
      return Boolean(element.closest('input, textarea, select'))
    }

    function selectionSnapshot() {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
      const range = selection.getRangeAt(0)
      if (range.collapsed) return null
      if (isOurNode(range.startContainer) || isOurNode(range.endContainer)) return null
      if (isForbidden(range.startContainer) || isForbidden(range.endContainer)) return null
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
      return {
        text,
        anchor: {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
      }
    }

    function setToast(message) {
      window.clearTimeout(toastTimer)
      toast.textContent = message
      toast.hidden = false
      toastTimer = window.setTimeout(() => {
        toast.hidden = true
      }, 1900)
    }

    function clearCopied() {
      window.clearTimeout(copyTimer)
      copied = false
    }

    function stopSpeech() {
      speechSeq += 1
      try {
        if (window.speechSynthesis) window.speechSynthesis.cancel()
      } catch {
        // Speech synthesis is optional.
      }
    }

    function clearResultTimers() {
      window.clearTimeout(copyTimer)
      copied = false
    }

    function renderContent() {
      if (!state) return
      content.replaceChildren()
      if (state.phase === 'summary') {
        const result = document.createElement('div')
        result.className = 'wt-result wt-result-summary'
        result.setAttribute('aria-live', 'polite')
        result.textContent = state.summary || state.text
        content.appendChild(result)
        return
      }
      if (state.status === 'loading') {
        const loading = document.createElement('div')
        loading.className = 'wt-loading'
        loading.setAttribute('role', 'status')
        loading.setAttribute('aria-live', 'polite')
        loading.innerHTML = `<div class="wt-loading-line"><span class="wt-wave" aria-hidden="true"><span></span><span></span><span></span></span><span>正在翻译…</span></div><div class="wt-skeleton" aria-hidden="true"><i></i><i></i><i></i></div>`
        content.appendChild(loading)
        return
      }
      if (state.status === 'error') {
        const error = document.createElement('div')
        error.className = 'wt-error'
        error.setAttribute('role', 'alert')
        const errorTitle = document.createElement('div')
        errorTitle.className = 'wt-error-title'
        errorTitle.textContent = '翻译没有完成'
        const errorText = document.createElement('div')
        errorText.className = 'wt-error-text'
        errorText.textContent = state.error
        const retry = document.createElement('button')
        retry.type = 'button'
        retry.className = 'wt-retry'
        const needsReload = state.errorCode === 'CONTEXT_INVALIDATED' || state.errorCode === 'MESSAGING_FAILED'
        retry.dataset.act = needsReload ? 'reload-page' : 'retry'
        retry.innerHTML = `${icon('refresh', 13)}${needsReload ? '刷新页面' : '重试'}`
        error.append(errorTitle, errorText, retry)
        content.appendChild(error)
        return
      }
      const result = document.createElement('div')
      result.className = 'wt-result'
      result.setAttribute('aria-live', 'polite')
      result.textContent = state.result
      content.appendChild(result)
    }

    function render() {
      if (!state) {
        host.style.display = 'none'
        barWrap.hidden = true
        panel.hidden = true
        return
      }
      host.style.display = 'block'
      const isBar = state.phase === 'bar'
      const isPanel = state.phase === 'panel' || state.phase === 'summary'
      const isSummary = state.phase === 'summary'
      barWrap.hidden = !isBar
      panel.hidden = !isPanel

      if (isBar) {
        host.style.left = `${state.bar.left}px`
        host.style.top = `${state.bar.top}px`
        host.style.width = `${state.bar.width}px`
        host.style.height = `${state.more ? BAR_HEIGHT + 8 + 200 : BAR_HEIGHT}px`
        host.style.maxHeight = 'none'
        speakIcon.innerHTML = icon(state.speaking ? 'stop' : 'speaker')
        speakLabel.textContent = state.speaking ? '停止' : '朗读'
        more.hidden = !state.more
        more.classList.toggle('wt-more-up', state.bar.top + BAR_HEIGHT + 190 > window.innerHeight)
        moreCopy.hidden = !state.result
      }

      if (isPanel) {
        host.style.left = `${state.panel.left}px`
        host.style.top = `${state.panel.top}px`
        host.style.width = `${state.panel.width}px`
        host.style.height = 'auto'
        host.style.maxHeight = `${state.panel.maxHeight}px`
        panel.style.maxHeight = `${state.panel.maxHeight}px`
        langs.hidden = isSummary
        title.textContent = isSummary ? '鲸语摘要' : '鲸译'
        subtitle.textContent = isSummary ? 'SUMMARY · 本地抽取' : 'WHALE MODE · 英汉互译'
        panel.setAttribute('aria-label', isSummary ? '鲸语摘要' : '鲸译翻译')
        detectedTag.textContent = languageName(state.detected)
        targetSelect.value = state.target
        for (const option of targetSelect.options) {
          option.disabled = option.value === state.detected
        }
        const canCopy = isSummary ? Boolean(state.summary) : Boolean(state.result)
        if (isSummary) {
          provider.textContent = '本地摘要 · 不联网'
        } else if (state.status === 'loading') {
          provider.textContent = '正在翻译'
        } else if (state.status === 'error') {
          provider.textContent = '翻译未完成'
        } else {
          provider.textContent = 'Bing · 翻译'
        }
        readBtn.disabled = !canCopy
        readBtn.innerHTML = icon(state.speaking ? 'stop' : 'speaker', 14)
        readBtn.title = state.speaking ? '停止朗读' : (isSummary ? '朗读摘要' : '朗读译文')
        readBtn.setAttribute('aria-label', readBtn.title)
        copyBtn.disabled = !canCopy
        copyBtn.classList.toggle('wt-copy-ok', copied && canCopy)
        copyLabel.textContent = copied && canCopy ? '已复制' : (isSummary ? '复制摘要' : '复制译文')
        renderContent()
      }
    }

    function hideAll() {
      host.style.display = 'none'
      barWrap.hidden = true
      panel.hidden = true
      more.hidden = true
    }

    function close() {
      if (state) dismissed = { text: state.text }
      requestSeq += 1
      if (abortRequest) {
        abortRequest.abort()
        abortRequest = null
      }
      stopSpeech()
      clearCopied()
      state = null
      hideAll()
    }

    function warmup() {
      if (Date.now() - warmedAt < 30_000) return
      warmedAt = Date.now()
      try {
        chrome.runtime.sendMessage({ type: 'whale-warmup' }, () => {
          void chrome.runtime.lastError
        })
      } catch {
        // The service worker starts on the real request if warming is unavailable.
      }
    }

    function openBar(snapshot) {
      dismissed = null
      if (abortRequest) {
        abortRequest.abort()
        abortRequest = null
      }
      stopSpeech()
      clearCopied()
      warmup()
      const detected = detectLanguage(snapshot.text)
      state = {
        phase: 'bar',
        text: snapshot.text,
        anchor: snapshot.anchor,
        bar: barGeometry(snapshot.anchor),
        panel: null,
        detected,
        target: detected === 'zh' ? 'en' : 'zh',
        targetMode: 'auto',
        status: 'idle',
        result: '',
        summary: '',
        error: '',
        errorCode: '',
        provider: 'bing',
        more: false,
        speaking: false,
      }
      render()
    }

    function scheduleSelection(delay) {
      window.clearTimeout(selectionTimer)
      selectionTimer = window.setTimeout(() => {
        const snapshot = selectionSnapshot()
        if (!snapshot) return
        if (state && state.text === snapshot.text) return
        if (dismissed && dismissed.text === snapshot.text) return
        openBar(snapshot)
      }, delay == null ? 0 : delay)
    }

    function messagingFailure(raw) {
      const text = String(raw || '')
      const stale = /extension context invalidated|receiving end does not exist|could not establish connection|message port closed/i.test(text)
      const message = stale
        ? '扩展已更新或后台未启动，请刷新页面后重试。'
        : (/[\u4e00-\u9fff]/.test(text) ? text : '翻译后台通信失败，请刷新页面后重试。')
      const error = new Error(message)
      error.code = stale ? 'CONTEXT_INVALIDATED' : 'MESSAGING_FAILED'
      return error
    }

    function translateViaBackground(text, targetMode, signal) {
      return new Promise((resolve, reject) => {
        let settled = false
        const finish = (fn, value) => {
          if (settled) return
          settled = true
          signal.removeEventListener('abort', onAbort)
          fn(value)
        }
        const onAbort = () => {
          finish(reject, signal.reason || new DOMException('aborted', 'AbortError'))
        }
        if (signal.aborted) {
          onAbort()
          return
        }
        signal.addEventListener('abort', onAbort, { once: true })
        try {
          chrome.runtime.sendMessage({
            type: 'whale-translate',
            text,
            source: 'auto',
            target: targetMode,
          }, (response) => {
            const runtimeError = chrome.runtime.lastError
            if (runtimeError) {
              finish(reject, messagingFailure(runtimeError.message))
              return
            }
            if (!response) {
              finish(reject, new Error('翻译服务没有返回结果。'))
              return
            }
            if (response.ok) {
              finish(resolve, response)
              return
            }
            const error = new Error(response.message || '翻译失败，请稍后重试。')
            error.code = response.code
            finish(reject, error)
          })
        } catch (error) {
          finish(reject, messagingFailure(error && error.message))
        }
      })
    }

    function beginTranslation(targetMode) {
      if (!state) return
      if (abortRequest) abortRequest.abort()
      const seq = requestSeq + 1
      requestSeq = seq
      const controller = new AbortController()
      abortRequest = controller
      clearCopied()
      const predicted = state.detected === 'zh' ? 'en' : 'zh'
      const shownTarget = targetMode === 'auto' ? predicted : targetMode
      state.phase = 'panel'
      state.panel = panelGeometry(state.anchor)
      state.targetMode = targetMode
      state.target = shownTarget
      state.status = 'loading'
      state.result = ''
      state.summary = ''
      state.error = ''
      state.errorCode = ''
      state.more = false
      render()

      if (state.text.length > MAX_TEXT) {
        state.status = 'error'
        state.error = `一次最多翻译 ${MAX_TEXT} 个字符，请缩短选区。`
        state.errorCode = 'TEXT_TOO_LONG'
        abortRequest = null
        render()
        return
      }

      const timeout = window.setTimeout(() => {
        if (requestSeq !== seq) return
        controller.abort(new DOMException('translation timed out', 'TimeoutError'))
        if (!state) return
        state.status = 'error'
        state.error = '翻译超时，请重试。'
        state.errorCode = 'TIMEOUT'
        render()
      }, 15_000)

      translateViaBackground(state.text, targetMode, controller.signal)
        .then((data) => {
          if (requestSeq !== seq || !state) return
          state.status = 'done'
          state.result = data.translation
          if (data.source === 'zh' || data.source === 'en') state.detected = data.source
          if (data.target === 'zh' || data.target === 'en') state.target = data.target
          state.provider = data.provider === 'mymemory' ? 'mymemory' : 'bing'
          state.panel = panelGeometry(state.anchor)
          render()
        })
        .catch((error) => {
          if (requestSeq !== seq || !state || controller.signal.aborted) return
          const message = readableError(error)
          if (!message) return
          state.status = 'error'
          state.error = message
          state.errorCode = error.code || ''
          render()
        })
        .finally(() => {
          window.clearTimeout(timeout)
          if (abortRequest === controller) abortRequest = null
        })
    }

    function changeTarget(value) {
      if (!state) return
      if (value === state.detected) {
        state.target = value
        state.targetMode = value
        state.status = 'error'
        state.result = ''
        state.error = value === 'zh' ? '原文已经是中文。换 English 试试。' : '原文已经是英文。换中文试试。'
        render()
        return
      }
      beginTranslation(value)
    }

    async function copy(text, message) {
      const okay = await copyToClipboard(text)
      setToast(okay ? message : '复制失败，请手动选择文字。')
      if (okay) {
        copied = true
        window.clearTimeout(copyTimer)
        copyTimer = window.setTimeout(() => {
          copied = false
          if (state && (state.phase === 'panel' || state.phase === 'summary')) render()
        }, 1500)
        if (state && (state.phase === 'panel' || state.phase === 'summary')) render()
      }
      return okay
    }

    function readAloud(text, language) {
      if (!state) return
      if (state.speaking) {
        stopSpeech()
        state.speaking = false
        render()
        return
      }
      if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
        setToast('当前环境不支持朗读')
        return
      }
      const clean = speakableText(text)
      if (!clean) return
      stopSpeech()
      const seq = speechSeq + 1
      speechSeq = seq
      const utterance = new window.SpeechSynthesisUtterance(clean)
      utterance.lang = language === 'zh' ? 'zh-CN' : 'en-US'
      utterance.rate = 0.98
      utterance.pitch = 1
      utterance.onend = () => {
        if (speechSeq === seq && state) {
          state.speaking = false
          render()
        }
      }
      utterance.onerror = () => {
        if (speechSeq === seq && state) {
          state.speaking = false
          render()
        }
      }
      try {
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(utterance)
        window.speechSynthesis.resume()
        state.speaking = true
        render()
      } catch {
        setToast('朗读启动失败')
      }
    }

    function openSearch() {
      if (!state) return
      const url = `https://www.bing.com/search?q=${encodeURIComponent(state.text)}`
      try {
        chrome.runtime.sendMessage({ type: 'whale-open-tab', url }, () => {
          void chrome.runtime.lastError
        })
      } catch {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
      close()
    }

    function openSummary() {
      if (!state) return
      if (abortRequest) {
        abortRequest.abort()
        abortRequest = null
      }
      requestSeq += 1
      clearCopied()
      state.phase = 'summary'
      state.panel = panelGeometry(state.anchor)
      state.summary = summarize(state.text)
      state.status = 'done'
      state.result = ''
      state.error = ''
      state.more = false
      render()
    }

    function backToBar() {
      if (!state) return
      requestSeq += 1
      if (abortRequest) {
        abortRequest.abort()
        abortRequest = null
      }
      stopSpeech()
      clearCopied()
      state.phase = 'bar'
      state.panel = null
      state.status = 'idle'
      state.result = ''
      state.summary = ''
      state.error = ''
      state.more = false
      state.speaking = false
      render()
    }

    root.addEventListener('mousedown', (event) => {
      event.stopPropagation()
    })
    root.addEventListener('click', (event) => {
      const button = event.target.closest && event.target.closest('button[data-act]')
      if (!button) return
      event.preventDefault()
      event.stopPropagation()
      if (!state) return
      const act = button.dataset.act
      if (act === 'search') openSearch()
      else if (act === 'copy-source') void copy(state.text, '已复制原文')
      else if (act === 'translate') beginTranslation('auto')
      else if (act === 'speak-source') readAloud(state.text, state.detected)
      else if (act === 'summary') openSummary()
      else if (act === 'more') {
        state.more = !state.more
        render()
      } else if (act === 'close') close()
      else if (act === 'back') backToBar()
      else if (act === 'reload-page') window.location.reload()
      else if (act === 'retry') beginTranslation(state.targetMode || 'auto')
      else if (act === 'read-result') {
        const isSummary = state.phase === 'summary'
        const text = isSummary ? state.summary : state.result
        readAloud(text, isSummary ? state.detected : state.target)
      } else if (act === 'copy-result') {
        const isSummary = state.phase === 'summary'
        const text = isSummary ? state.summary : state.result
        void copy(text, isSummary ? '已复制摘要' : '已复制译文')
      }
    })

    targetSelect.addEventListener('change', () => {
      if (!state) return
      changeTarget(targetSelect.value)
    })

    function eventInsideUi(event) {
      return event.target === host || host.contains(event.target) || event.composedPath().includes(host)
    }

    const onMouseUp = (event) => {
      if (event.button !== 0) return
      if (eventInsideUi(event)) return
      const down = pointerDown
      pointerDown = null
      const selection = window.getSelection()
      const text = selection ? normalizeSelectedText(selection.toString()) : ''
      const dragged = Boolean(down) && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4
      if (text.trim() === '') return
      if (down && text === down.text && !dragged) return
      scheduleSelection(0)
    }
    const onMouseDown = (event) => {
      if (eventInsideUi(event)) return
      if (state) close()
      dismissed = null
      if (event.button !== 0) {
        pointerDown = null
        return
      }
      const selection = window.getSelection()
      pointerDown = {
        x: event.clientX,
        y: event.clientY,
        text: selection ? normalizeSelectedText(selection.toString()) : '',
      }
    }
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || !state) return
      event.preventDefault()
      close()
    }
    const onKeyUp = (event) => {
      if (eventInsideUi(event)) return
      if (event.shiftKey) scheduleSelection(130)
    }
    const onSelectionChange = () => {
      if (pointerDown) return
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return
      scheduleSelection(180)
    }
    const onTouchEnd = (event) => {
      if (eventInsideUi(event)) return
      scheduleSelection(160)
    }
    const onScroll = () => {
      if (state && state.phase === 'bar') close()
    }
    const onResize = () => {
      if (state) close()
    }
    const onBlur = () => {
      pointerDown = null
    }

    document.addEventListener('mouseup', onMouseUp, true)
    document.addEventListener('mousedown', onMouseDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)
    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('touchend', onTouchEnd, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    window.addEventListener('blur', onBlur)

    document.documentElement.appendChild(host)
    warmup()
  }

  void boot()
})()
