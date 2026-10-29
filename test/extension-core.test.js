import test from 'node:test'
import assert from 'node:assert/strict'

import { detectLanguage, translateText } from '../extension/translate-core.js'

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

test('extension core detects the advertised pair', () => {
  assert.equal(detectLanguage('Hello there, this is English.'), 'en')
  assert.equal(detectLanguage('这是一段中文。'), 'zh')
})

test('extension core keeps line edges and translates through Bing', async () => {
  installFetch(async () => bingResponse(['hola\nmundo'], 'zh'))
  const result = await translateText('  你好\n世界  ', { source: 'auto', target: 'en' })
  assert.equal(result.provider, 'bing')
  assert.equal(result.translation, '  hola\nmundo  ')
  assert.equal(result.source, 'zh')
  assert.equal(result.target, 'en')
})

test('extension core repairs a collapsed newline skeleton', async () => {
  installFetch(async (_url, init) => {
    const payload = JSON.parse(init.body)
    if (payload.length > 1) return bingResponse(payload.map((line) => `T:${line}`))
    return bingResponse(['one collapsed line'])
  })
  const result = await translateText('Line one\nLine two', { source: 'auto', target: 'zh' })
  assert.equal(result.translation, 'T:Line one\nT:Line two')
})

test('extension core returns a fast error when Bing is unreachable', async () => {
  let bingCalls = 0
  installFetch(async () => {
    bingCalls += 1
    throw new TypeError('fetch failed')
  })

  await assert.rejects(
    translateText('Hello, world', { source: 'auto', target: 'zh' }),
    (error) => error.code === 'UPSTREAM_ERROR' && error.status === 502,
  )
  assert.equal(bingCalls, 1)
})

test('extension core turns a 429 into a fast busy error', async () => {
  installFetch(async () => ({
    ok: false,
    status: 429,
    json: async () => null,
    body: { cancel: async () => undefined },
  }))

  await assert.rejects(
    translateText('A short request that is rate limited', { source: 'auto', target: 'zh' }),
    (error) => error.code === 'UPSTREAM_BUSY' && error.status === 503,
  )
})

test('extension core splits a long selection into ordered chunks', async () => {
  let calls = 0
  installFetch(async (_url, init) => {
    calls += 1
    const payload = JSON.parse(init.body)
    return bingResponse([`[${payload[0].length}]`])
  })
  const result = await translateText('x'.repeat(4_000), { source: 'auto', target: 'zh' })
  assert.equal(calls, 2)
  assert.equal(result.translation, '[3600][400]')
})
