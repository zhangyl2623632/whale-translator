import test from 'node:test'
import assert from 'node:assert/strict'

import { detectLanguage, translateSelection } from '../index.js'

const realFetch = globalThis.fetch

function bingResponse(items, detected = 'en') {
  return {
    ok: true,
    status: 200,
    json: async () => items.map((text) => ({
      translations: [{ text }],
      detectedLanguage: { language: detected },
    })),
    body: { cancel: async () => undefined },
  }
}

function installFetch(handler) {
  globalThis.fetch = async (input, init = {}) => handler(String(input), init)
}

test.afterEach(() => {
  globalThis.fetch = realFetch
})

test('detectLanguage separates the advertised pair', () => {
  assert.equal(detectLanguage('Hello there, this is English.'), 'en')
  assert.equal(detectLanguage('这是一段中文。'), 'zh')
  assert.equal(detectLanguage('这是 LOOP Flex 贷款'), 'zh')
})

test('translateSelection prefers the DSH translator service', async () => {
  let bingCalls = 0
  installFetch(async () => {
    bingCalls += 1
    return bingResponse(['不应调用 Bing'])
  })
  const requests = []
  const translator = {
    availableProviders: async () => ['google'],
    resolve: (request) => {
      requests.push(request)
      return { ...request, provider: 'google' }
    },
    translate: async () => '你好',
  }

  const result = await translateSelection('Hello', { source: 'en', target: 'zh', translator })
  assert.equal(result.provider, 'google')
  assert.equal(result.translation, '你好')
  assert.equal(bingCalls, 0)
  assert.equal(requests[0].sourceLanguage, 'en')
  assert.equal(requests[0].targetLanguage, 'zh-Hans')
})

test('translateSelection falls back to Bing when the DSH translator fails', async () => {
  installFetch(async () => bingResponse(['你好']))
  const translator = {
    availableProviders: async () => ['google'],
    resolve: (request) => ({ ...request, provider: 'google' }),
    translate: async () => { throw new Error('provider unavailable') },
  }

  const result = await translateSelection('Hello fallback', { source: 'en', target: 'zh', translator })
  assert.equal(result.provider, 'bing')
  assert.equal(result.translation, '你好')
})

test('translateSelection keeps the newline skeleton and trims provider edges', async () => {
  installFetch(async () => bingResponse(['hola\nmundo'], 'zh'))
  const result = await translateSelection('  你好\n世界  ', { source: 'auto', target: 'en' })
  assert.equal(result.provider, 'bing')
  assert.equal(result.translation, '  hola\nmundo  ')
  assert.equal(result.source, 'zh')
  assert.equal(result.target, 'en')
})

test('translateSelection repairs a collapsed newline skeleton line by line', async () => {
  let batchSizes = []
  installFetch(async (_url, init) => {
    const payload = JSON.parse(init.body)
    batchSizes.push(payload.length)
    if (payload.length > 1) return bingResponse(payload.map((line) => `T:${line}`))
    return bingResponse(['one collapsed line'])
  })

  const result = await translateSelection('Line one\nLine two', { source: 'auto', target: 'zh' })
  assert.equal(result.translation.split('\n').length, 2)
  assert.match(result.translation, /^T:Line one\nT:Line two$/)
  assert.deepEqual(batchSizes, [1, 2])
})

test('translateSelection returns a fast error when Bing is unreachable', async () => {
  let bingCalls = 0
  installFetch(async () => {
    bingCalls += 1
    throw new TypeError('fetch failed')
  })

  await assert.rejects(
    translateSelection('Hello, world', { source: 'auto', target: 'zh' }),
    (error) => error.code === 'UPSTREAM_ERROR' && error.status === 502,
  )
  assert.equal(bingCalls, 1)
})

test('translateSelection returns a fast busy error on a Bing 429', async () => {
  let bingCalls = 0
  installFetch(async () => {
    bingCalls += 1
    return {
      ok: false,
      status: 429,
      json: async () => null,
      body: { cancel: async () => undefined },
    }
  })

  await assert.rejects(
    translateSelection('A short request that is rate limited', { source: 'auto', target: 'zh' }),
    (error) => error.code === 'UPSTREAM_BUSY' && error.status === 503,
  )
  assert.equal(bingCalls, 2)
})

test('translateSelection rejects empty, oversized, and same-language requests', async () => {
  await assert.rejects(
    translateSelection('   ', { target: 'auto' }),
    (error) => error.code === 'EMPTY_TEXT' && error.status === 400,
  )
  await assert.rejects(
    translateSelection('x'.repeat(12_001), { target: 'auto' }),
    (error) => error.code === 'TEXT_TOO_LONG' && error.status === 413,
  )
  await assert.rejects(
    translateSelection('这是一段只有中文的内容。', { source: 'auto', target: 'zh' }),
    (error) => error.code === 'SAME_LANGUAGE' && error.status === 422,
  )
})

test('translateSelection serves a cached result without another request', async () => {
  let calls = 0
  installFetch(async () => {
    calls += 1
    return bingResponse(['bonjour'])
  })

  const first = await translateSelection('Hello cache', { source: 'auto', target: 'zh' })
  const second = await translateSelection('Hello cache', { source: 'auto', target: 'zh' })
  assert.equal(calls, 1)
  assert.deepEqual(first, second)
})
