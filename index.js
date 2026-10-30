/**
 * Host half of the whale selection translator.
 *
 * The browser sends the selected text to this same-origin route. Translation is
 * performed by Microsoft's Edge translator endpoint. The route is deliberately
 * small: it owns direction detection, length limits, upstream normalization,
 * newline preservation and a bounded cache.
 */
import { randomBytes } from 'node:crypto'

const ROUTE_PATH = '/api/dsh/whale-translator/translate'
const BING_ENDPOINT = 'https://edge.microsoft.com/translate/translatetext'
const MAX_TEXT = 12_000
const MAX_BODY = 96 * 1024
const MAX_REQUEST_CHARS = 3_600
const REQUEST_TIMEOUT_MS = 5_000
const TOTAL_TIMEOUT_MS = 12_000
const ROUTE_TOKEN = randomBytes(24).toString('base64url')
const TOKEN_HEADER = 'x-whale-translator-token'
const CHUNK_CONCURRENCY = 2
const CACHE_LIMIT = 240
const CACHE_CHARS_LIMIT = 2_000_000

const HAN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g
const LATIN_RE = /[A-Za-z]/g

const cache = new Map()
const BODY_TOO_LARGE = Symbol('whale-translator:body-too-large')
let cacheChars = 0

class TranslateFailure extends Error {
  constructor(code, message, status = 500, upstreamStatus = undefined) {
    super(message)
    this.name = 'TranslateFailure'
    this.code = code
    this.status = status
    this.upstreamStatus = upstreamStatus
  }
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.setHeader('content-length', Buffer.byteLength(text))
  res.end(text)
}

function sameOrigin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers.origin
  if (typeof origin !== 'string' || origin === '' || origin === 'null') return true
  const host = req.headers.host
  if (typeof host !== 'string' || host === '') return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function readJsonBody(req, limit = MAX_BODY) {
  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    req.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > limit) {
        finish(BODY_TOO_LARGE)
        req.resume()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      if (!chunks.length) return finish({})
      try {
        finish(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        finish(null)
      }
    })
    req.on('error', () => finish(null))
  })
}

function normalizeNewlines(text) {
  return String(text).replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ')
}

/** True for the two directions this plugin advertises, plus the auto sentinel. */
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

/** A tiny, deterministic language check for the English/Chinese pair. */
export function detectLanguage(text) {
  const han = (text.match(HAN_RE) || []).length
  const latin = (text.match(LATIN_RE) || []).length
  if (han === 0) return 'en'
  if (latin === 0) return 'zh'
  return han >= latin * 0.5 ? 'zh' : 'en'
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

/** Keep the translated line count, but restore each line's original edge whitespace. */
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

/** Split at paragraph, then line, then word boundaries without losing a byte. */
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

function bingLanguage(language) {
  if (language === 'zh') return 'zh-Hans'
  return 'en'
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
  if (error instanceof TranslateFailure) return error
  if (error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return new TranslateFailure('TIMEOUT', '翻译超时，请稍后重试。', 504)
  }
  return new TranslateFailure('UPSTREAM_ERROR', '翻译服务暂时不可用，请稍后重试。', 502)
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
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify([text]),
      redirect: 'error',
      credentials: 'omit',
      signal,
    })
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined)
      throw new TranslateFailure('UPSTREAM_HTTP', `翻译服务返回 HTTP ${response.status}。`, 502, response.status)
    }
    let payload
    try {
      payload = await response.json()
    } catch {
      throw new TranslateFailure('INVALID_RESPONSE', '翻译服务返回了无法识别的结果。', 502)
    }
    const first = Array.isArray(payload) ? payload[0] : null
    const value = first && Array.isArray(first.translations) ? first.translations[0] : null
    if (!value || typeof value.text !== 'string') {
      throw new TranslateFailure('INVALID_RESPONSE', '翻译服务返回了无法识别的结果。', 502)
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

/** Run at most `limit` mapper calls at a time while preserving result order. */
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

/**
 * Guarantee a one-for-one line mapping when the provider changes the newline
 * structure. Each non-empty line is translated as its own array item, so the
 * visible line count can never drift.
 */
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
    if (!response.ok) throw new TranslateFailure('UPSTREAM_HTTP', `翻译服务返回 HTTP ${response.status}。`, 502, response.status)
    const payload = await response.json().catch(() => null)
    if (!Array.isArray(payload) || payload.length !== texts.length) {
      throw new TranslateFailure('INVALID_RESPONSE', '翻译服务返回了无法识别的结果。', 502)
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

function cacheCost(key, value) {
  return key.length + (value && typeof value.translation === 'string' ? value.translation.length : 0)
}

function remember(key, value) {
  if (cache.has(key)) {
    const previous = cache.get(key)
    cacheChars -= cacheCost(key, previous)
    cache.delete(key)
  }
  cache.set(key, value)
  cacheChars += cacheCost(key, value)
  while (cache.size > CACHE_LIMIT || cacheChars > CACHE_CHARS_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    const evicted = cache.get(oldest)
    cacheChars -= cacheCost(oldest, evicted)
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

/**
 * Translate one selection while preserving its exact newline skeleton.
 * Exported for a small Node-level contract test.
 */
export async function translateSelection(rawText, options = {}) {
  if (options.signal && options.signal.aborted) throw options.signal.reason
  const text = normalizeNewlines(rawText)
  if (text.trim() === '') {
    throw new TranslateFailure('EMPTY_TEXT', '没有可翻译的文字。', 400)
  }
  if (text.length > MAX_TEXT) {
    throw new TranslateFailure('TEXT_TOO_LONG', `一次最多翻译 ${MAX_TEXT} 个字符，请缩短选区。`, 413)
  }

  const requestedSource = normalizeDirection(options.source)
  const localSource = detectLanguage(text)
  let source = requestedSource === 'auto' ? localSource : requestedSource
  const requestedTarget = normalizeDirection(options.target)
  let target = requestedTarget === 'auto' ? (source === 'zh' ? 'en' : 'zh') : requestedTarget
  if (target === source) {
    throw new TranslateFailure('SAME_LANGUAGE', source === 'zh' ? '原文已经是中文，请选择 English。' : '原文已经是英文，请选择中文。', 422)
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
    if (bingError instanceof TranslateFailure && bingError.code === 'UPSTREAM_HTTP') {
      throw new TranslateFailure('UPSTREAM_BUSY', '翻译服务繁忙，请稍后重试。', 503, bingError.upstreamStatus)
    }
    if (bingError instanceof TranslateFailure) throw bingError
    throw new TranslateFailure('UPSTREAM_ERROR', '翻译服务暂时不可用，请稍后重试。', 502)
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
    throw new TranslateFailure('EMPTY_TRANSLATION', '没有拿到译文，请重试。', 502)
  }

  if (detected) source = detected
  if (requestedTarget === 'auto' && target === source) {
    // Bing's detection can disagree with the local heuristic. Never return a
    // same-language no-op; resolve the intended opposite direction once more.
    const betterTarget = source === 'zh' ? 'en' : 'zh'
    if (betterTarget !== target) {
      const retry = await translateSelection(text, { source: 'auto', target: betterTarget, signal: options.signal })
      return retry
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

function createHandler(token = ROUTE_TOKEN) {
  return async (req, res) => {
    const pathname = (req.url || '').split('?')[0]
    if (pathname !== ROUTE_PATH) {
      sendJson(res, 404, { ok: false, error: 'not-found' })
      return
    }
    if (!sameOrigin(req)) {
      sendJson(res, 403, { ok: false, error: 'cross-site-request-rejected' })
      return
    }
    if (req.headers[TOKEN_HEADER] !== token) {
      sendJson(res, 403, { ok: false, error: 'unauthorized', message: '翻译鉴权失败，请刷新页面。' })
      return
    }
    if (req.method !== 'POST') {
      res.setHeader('allow', 'POST')
      sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
      return
    }

    const contentType = String(req.headers['content-type'] || '').trim().toLowerCase()
    if (!contentType.startsWith('application/json')) {
      req.resume()
      sendJson(res, 415, { ok: false, error: 'unsupported-media-type', message: '请求需要 application/json。' })
      return
    }
    const declaredLength = Number(req.headers['content-length'])
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY) {
      req.resume()
      sendJson(res, 413, { ok: false, error: 'body-too-large', message: '请求内容过大。' })
      return
    }

    const body = await readJsonBody(req)
    if (body === BODY_TOO_LARGE) {
      sendJson(res, 413, { ok: false, error: 'body-too-large', message: '请求内容过大。' })
      return
    }
    if (!body || typeof body !== 'object' || typeof body.text !== 'string') {
      sendJson(res, 400, { ok: false, error: 'invalid-body', message: '没有收到可翻译的文字。' })
      return
    }

    const controller = new AbortController()
    const deadline = setTimeout(() => {
      controller.abort(new DOMException('translation budget exceeded', 'TimeoutError'))
    }, TOTAL_TIMEOUT_MS)
    req.on('aborted', () => controller.abort())
    res.on('close', () => {
      if (!res.writableEnded) controller.abort()
    })

    try {
      const result = await translateSelection(body.text, {
        source: body.source,
        target: body.target,
        signal: controller.signal,
      })
      sendJson(res, 200, result)
    } catch (error) {
      const failure = error instanceof TranslateFailure
        ? error
        : error && (error.name === 'AbortError' || error.name === 'TimeoutError')
          ? new TranslateFailure('TIMEOUT', '翻译超时，请稍后重试。', 504)
          : new TranslateFailure('TRANSLATION_FAILED', '翻译失败，请稍后重试。', 500)
      if (!res.writableEnded && !res.destroyed) {
        sendJson(res, failure.status, {
          ok: false,
          error: failure.code,
          message: failure.message,
        })
      }
    } finally {
      clearTimeout(deadline)
    }
  }
}

export function apply(ctx) {
  const route = {
    kind: 'exact',
    path: ROUTE_PATH,
    handler: createHandler(ROUTE_TOKEN),
  }
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (scope) => {
      scope.effect(() => scope.webServer.register(route), 'whale-translator: same-origin translation route')
      if (typeof scope.webServer.tapIndex === 'function') {
        scope.effect(
          () => scope.webServer.tapIndex((html) => html.replace(
            /<\/head>/i,
            `<meta name="whale-translator-token" content="${ROUTE_TOKEN}"></head>`,
          )),
          'whale-translator: per-process page token',
        )
      }
    })
  }
}
