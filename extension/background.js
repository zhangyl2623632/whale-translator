import { translateText } from './translate-core.js'

const REQUEST_BUDGET_MS = 12_000

async function translate(message) {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new DOMException('translation budget exceeded', 'TimeoutError'))
  }, REQUEST_BUDGET_MS)
  try {
    return await translateText(message.text, {
      source: message.source,
      target: message.target,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false

  if (message.type === 'whale-warmup') {
    // Wake the worker and warm the TLS connection without sending any selected text.
    fetch('https://edge.microsoft.com/translate/translatetext', {
      method: 'HEAD',
      cache: 'no-store',
    }).catch(() => undefined)
    sendResponse({ ok: true })
    return false
  }

  if (message.type === 'whale-translate') {
    translate(message)
      .then((result) => {
        sendResponse({ ok: true, ...result })
      })
      .catch((error) => {
        const timeout = error && (error.name === 'TimeoutError' || error.name === 'AbortError')
        sendResponse({
          ok: false,
          code: timeout ? 'TIMEOUT' : (error && error.code ? error.code : 'TRANSLATION_FAILED'),
          message: timeout
            ? '翻译超时，请稍后重试。'
            : (error && error.message ? error.message : '翻译失败，请稍后重试。'),
        })
      })
    return true
  }

  if (message.type === 'whale-open-tab') {
    const url = typeof message.url === 'string' ? message.url : ''
    if (!/^https:\/\//i.test(url)) {
      sendResponse({ ok: false })
      return false
    }
    chrome.tabs.create({ url }, () => {
      sendResponse({ ok: !chrome.runtime.lastError })
    })
    return true
  }

  return false
})
