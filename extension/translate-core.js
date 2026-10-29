/**
 * Shared translation core for the standalone browser extension.
 *
 * This file is intentionally free of Node.js and DOM APIs: the MV3 service
 * worker imports it, and the Node test suite can import it directly.
 */

const BING_ENDPOINT = 'https://edge.microsoft.com/translate/translatetext'
const MAX_TEXT = 12_000
const MAX_REQUEST_CHARS = 3_600
const REQUEST_TIMEOUT_MS = 5_000
const CHUNK_CONCURRENCY = 2
const CACHE_LIMIT = 120
const CACHE_CHARS_LIMIT = 1_000_000

const HAN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g
const LATIN_RE = /[A-Za-z]/g

const cache = new Map()
let cacheChars = 0

export class TranslationError extends Error {
  constructor(code, message, status = 500, upstreamStatus = undefined) {
    super(message)
    this.name = 'TranslationError'
    this.code = code
    this.status = status
    this.upstreamStatus = upstreamStatus
  }
}

export function normalizeNewlines(text) {
  return String(text).replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ')
}

export function detectLanguage(text) {
  const han = (text.match(HAN_RE) || []).length
  const latin = (text.match(LATIN_RE) || []).length
  if (han === 0) return 'en'
  if (latin === 0) return 'zh'
  return han >= latin * 0.5 ? 'zh' : 'en'
}

function normalizeDirection(value) {
  if (value === 'zh' || value === 'zh-CN' || value === 'zh-Hans') return 'zh'
  if (value === 'en' || value === 'en-US' || value === 'en-GB') return 'en'
  return 'auto'
}

function normalizeDetected(value) {
  if (typeof value !== 'string') return null
  const lower = value.toLowerCase()
  if (lower === 'zh' || lower.startsWith('zh-')) return 'zh'
  if (lower === 'en' || lower.startsWith('en-')) return 'en'
  return null
}

function bingLanguage(language) {
  return language === 'zh' ? 'zh-Hans' : 'en'
}

function newlineShape(text) {
  const runs = []
  let run = 0
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') {
      run += 1
    } else if (run > 0) {
      runs.push(run)
      run = 0
    }
  }
  if (run > 0) runs.push(run)
  return runs.join('.')
}

function restoreLineEdges(source, translated) {
  const sourceLines = source.split('\n')
  const translatedLines = translated.split('\n')
  if (sourceLines.length !== translatedLines.length) return translated
  return translatedLines.map((line, index) => {
    const original = sourceLines[index]
    if (original.trim() === '') return original
    const leading = (original.match(/^\s*/) || [''])[0]
    const trailing = (original.match(/\s*$/) || [''])[0]
    return leading + line.trim() + trailing
  }).join('\n')
}

function safeCut(text, cut) {
  if (cut <= 0) return 1
  if (cut >= text.length) return text.length
  const code = text.charCodeAt(cut - 1)
  return code >= 0xd800 && code <= 0xdbff ? cut - 1 : cut
}

function packText(text, limit) {
  if (text.length <= limit) return [text]
  const chunks = []
  let rest = text
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n\n', limit)
    if (cut < limit * 0.55) cut = rest.lastIndexOf('\n', limit)
    if (cut < limit * 0.55) cut = rest.lastIndexOf(' ', limit)
    if (cut < limit * 0.55) cut = limit
    cut = safeCut(rest, cut)
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  if (rest !== '') chunks.push(rest)
  return chunks
}

function mergeSignals(caller, timer) {
  if (caller && typeof AbortSignal.any === 'function') {
    try {
      return AbortSignal.any([caller, timer])
    } catch {
      return timer
    }
  }
  return timer
}

function describeError(error) {
  if (error instanceof TranslationError) return error
  if (error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return new TranslationError('TIMEOUT', '翻译超时，请稍后重试。', 504)
  }
  return new TranslationError('UPSTREAM_ERROR', '翻译服务暂时不可用，请稍后重试。', 502)
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    if (!signal) return
    const stop = () => {
      clearTimeout(timer)
      reject(signal.reason || new DOMException('aborted', 'AbortError'))
    }
    if (signal.aborted) stop()
    else signal.addEventListener('abort', stop, { once: true })
  })
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  const workers = Array.from(
    { length: Math.min(Math.max(1, limit), items.length) },
    async () => {
      while (true) {
        const index = cursor
        cursor += 1
        if (index >= items.length) return
        results[index] = await mapper(items[index], index)
      }
    },
  )
  await Promise.all(workers)
  return results
}

async function requestBing(text, source, target, callerSignal) {
  const url = new URL(BING_ENDPOINT)
  url.searchParams.set('to', bingLanguage(target))
  url.searchParams.set('isEnterpriseClient', 'false')
  if (source !== 'auto') url.searchParams.set('from', bingLanguage(source))

  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new DOMException('translation timed out', 'TimeoutError'))
  }, REQUEST_TIMEOUT_MS)
  const signal = mergeSignals(callerSignal, controller.signal)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify([text]),
      redirect: 'error',
      credentials: 'omit',
      signal,
    })
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined)
      throw new TranslationError('UPSTREAM_HTTP', `翻译服务返回 HTTP ${response.status}。`, 502, response.status)
    }
    let payload
    try {
      payload = await response.json()
    } catch {
      throw new TranslationError('INVALID_RESPONSE', '翻译服务返回了无法识别的结果。', 502)
    }
    const first = Array.isArray(payload) ? payload[0] : null
    const value = first && Array.isArray(first.translations) ? first.translations[0] : null
    if (!value || typeof value.text !== 'string') {
      throw new TranslationError('INVALID_RESPONSE', '翻译服务返回了无法识别的结果。', 502)
    }
    return {
      text: normalizeNewlines(value.text),
      detected: normalizeDetected(first.detectedLanguage && first.detectedLanguage.language),
    }
  } catch (error) {
    throw describeError(error)
  } finally {
    clearTimeout(timer)
  }
}

async function requestBingWithRetry(text, source, target, signal) {
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await requestBing(text, source, target, signal)
    } catch (error) {
      lastError = error
      if (signal && signal.throwIfAborted) signal.throwIfAborted()
      const rateLimited = error && error.code === 'UPSTREAM_HTTP' && (
        error.upstreamStatus === 429 || error.upstreamStatus >= 500
      )
      if (!rateLimited) throw error
      if (attempt === 0) await wait(250, signal)
    }
  }
  throw lastError
}

async function requestBingBatch(texts, source, target, callerSignal) {
  const url = new URL(BING_ENDPOINT)
  url.searchParams.set('to', bingLanguage(target))
  url.searchParams.set('isEnterpriseClient', 'false')
  if (source !== 'auto') url.searchParams.set('from', bingLanguage(source))

  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new DOMException('translation timed out', 'TimeoutError'))
  }, REQUEST_TIMEOUT_MS)
  const signal = mergeSignals(callerSignal, controller.signal)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(texts),
      redirect: 'error',
      credentials: 'omit',
      signal,
    })
    if (!response.ok) {
      throw new TranslationError('UPSTREAM_HTTP', `翻译服务返回 HTTP ${response.status}。`, 502, response.status)
    }
    const payload = await response.json().catch(() => null)
    if (!Array.isArray(payload) || payload.length !== texts.length) {
      throw new TranslationError('INVALID_RESPONSE', '翻译服务返回了无法识别的结果。', 502)
    }
    return payload.map((item) => {
      const value = item && Array.isArray(item.translations) ? item.translations[0] : null
      return value && typeof value.text === 'string' ? normalizeNewlines(value.text) : ''
    })
  } catch (error) {
    throw describeError(error)
  } finally {
    clearTimeout(timer)
  }
}

function splitWhitespace(line) {
  const leading = (line.match(/^\s*/) || [''])[0]
  const trailing = (line.match(/\s*$/) || [''])[0]
  const end = Math.max(leading.length, line.length - trailing.length)
  return {
    leading,
    core: line.slice(leading.length, end),
    trailing: line.length > end ? line.slice(end) : '',
  }
}

async function translateByLines(text, source, target, signal, batchTranslator, concurrency = 1) {
  const lines = text.split('\n')
  const pieces = lines.map(splitWhitespace)
  const indices = []
  for (let index = 0; index < pieces.length; index += 1) {
    if (pieces[index].core.trim() !== '') indices.push(index)
  }

  const translated = new Array(lines.length).fill('')
  const batches = []
  let batch = []
  let batchChars = 0
  for (const index of indices) {
    const length = pieces[index].core.length
    if (batch.length > 0 && (batch.length >= 10 || batchChars + length > MAX_REQUEST_CHARS)) {
      batches.push(batch)
      batch = []
      batchChars = 0
    }
    batch.push(index)
    batchChars += length
  }
  if (batch.length > 0) batches.push(batch)

  await mapLimit(batches, concurrency, async (batchIndices) => {
    const payload = batchIndices.map((index) => pieces[index].core)
    const result = await batchTranslator(payload, source, target, signal)
    batchIndices.forEach((lineIndex, batchIndex) => {
      const core = result[batchIndex]
      translated[lineIndex] = core && core.trim() !== ''
        ? pieces[lineIndex].leading + core.replace(/\s*\n+\s*/g, ' ') + pieces[lineIndex].trailing
        : lines[lineIndex]
    })
  })
  for (let index = 0; index < lines.length; index += 1) {
    if (translated[index] === '' && lines[index] !== '') translated[index] = lines[index]
  }
  return translated.join('\n')
}

function cacheCost(key, value) {
  return key.length + (value && typeof value.translation === 'string' ? value.translation.length : 0)
}

function remember(key, value) {
  if (cache.has(key)) {
    cacheChars -= cacheCost(key, cache.get(key))
    cache.delete(key)
  }
  cache.set(key, value)
  cacheChars += cacheCost(key, value)
  while (cache.size > CACHE_LIMIT || cacheChars > CACHE_CHARS_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cacheChars -= cacheCost(oldest, cache.get(oldest))
    cache.delete(oldest)
  }
  if (cacheChars < 0) cacheChars = 0
}

function lookup(key) {
  const value = cache.get(key)
  if (value === undefined) return undefined
  cache.delete(key)
  cache.set(key, value)
  return value
}

export async function translateText(rawText, options = {}) {
  if (options.signal && options.signal.aborted) throw options.signal.reason
  const text = normalizeNewlines(rawText)
  if (text.trim() === '') {
    throw new TranslationError('EMPTY_TEXT', '没有可翻译的文字。', 400)
  }
  if (text.length > MAX_TEXT) {
    throw new TranslationError('TEXT_TOO_LONG', `一次最多翻译 ${MAX_TEXT} 个字符，请缩短选区。`, 413)
  }

  const requestedSource = normalizeDirection(options.source)
  const localSource = detectLanguage(text)
  let source = requestedSource === 'auto' ? localSource : requestedSource
  const requestedTarget = normalizeDirection(options.target)
  let target = requestedTarget === 'auto' ? (source === 'zh' ? 'en' : 'zh') : requestedTarget
  if (target === source) {
    throw new TranslationError('SAME_LANGUAGE', source === 'zh' ? '原文已经是中文，请选择 English。' : '原文已经是英文，请选择中文。', 422)
  }

  const cacheKey = `${source}>${target}:${text}`
  const cached = lookup(cacheKey)
  if (cached) return cached

  let rendered = []
  let detected = null
  try {
    const chunks = packText(text, MAX_REQUEST_CHARS)
    rendered = await mapLimit(chunks, CHUNK_CONCURRENCY, async (chunk) => {
      if (chunk.trim() === '') return chunk
      const part = await requestBingWithRetry(chunk, source, target, options.signal)
      if (part.detected) detected = part.detected
      return part.text
    })
  } catch (bingError) {
    if (options.signal && options.signal.aborted) throw options.signal.reason
    if (bingError instanceof TranslationError && bingError.code === 'UPSTREAM_HTTP') {
      throw new TranslationError('UPSTREAM_BUSY', '翻译服务繁忙，请稍后重试。', 503, bingError.upstreamStatus)
    }
    if (bingError instanceof TranslationError) throw bingError
    throw new TranslationError('UPSTREAM_ERROR', '翻译服务暂时不可用，请稍后重试。', 502)
  }

  let translation = rendered.join('')
  const sourceShape = newlineShape(text)
  if (sourceShape !== newlineShape(translation)) {
    translation = await translateByLines(
      text,
      source,
      target,
      options.signal,
      requestBingBatch,
      CHUNK_CONCURRENCY,
    )
  } else {
    translation = restoreLineEdges(text, translation)
  }
  if (translation.trim() === '') {
    throw new TranslationError('EMPTY_TRANSLATION', '没有拿到译文，请重试。', 502)
  }

  if (detected) source = detected
  if (requestedTarget === 'auto' && target === source) {
    const betterTarget = source === 'zh' ? 'en' : 'zh'
    if (betterTarget !== target) {
      return translateText(text, { source: 'auto', target: betterTarget, signal: options.signal })
    }
  }

  const result = {
    ok: true,
    translation,
    source,
    target,
    provider: 'bing',
    chars: text.length,
  }
  remember(cacheKey, result)
  return result
}
