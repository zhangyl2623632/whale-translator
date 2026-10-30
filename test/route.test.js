import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import { apply } from '../index.js'

const realFetch = globalThis.fetch

function translationResponse(text) {
  return {
    ok: true,
    status: 200,
    json: async () => [{
      translations: [{ text }],
      detectedLanguage: { language: 'en' },
    }],
    body: { cancel: async () => undefined },
  }
}

function captureRoute() {
  let route
  let tapIndex
  const ctx = {
    inject(_deps, callback) {
      callback({
        effect(fn) {
          fn()
          return () => undefined
        },
        webServer: {
          register(value) {
            route = value
            return () => undefined
          },
          tapIndex(fn) {
            tapIndex = fn
            return () => undefined
          },
        },
      })
    },
  }
  apply(ctx)
  assert.ok(route, 'apply() should register a web route')
  assert.equal(typeof tapIndex, 'function', 'apply() should inject the page token')
  const html = tapIndex('<html><head></head><body></body></html>')
  const match = /name="whale-translator-token" content="([^"]+)"/.exec(html)
  assert.ok(match, 'the page token should be injected into the index head')
  return { route, token: match[1] }
}

async function withServer(run) {
  const { route, token } = captureRoute()
  const server = http.createServer((req, res) => {
    void route.handler(req, res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    await run(`http://127.0.0.1:${port}`, token)
  } finally {
    server.closeAllConnections?.()
    await new Promise((resolve) => server.close(resolve))
  }
}

test.afterEach(() => {
  globalThis.fetch = realFetch
})

test('route translates a same-origin JSON request', async () => {
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.startsWith('http://127.0.0.1:')) return realFetch(input, init)
    return translationResponse('你好')
  }
  await withServer(async (origin, token) => {
    const response = await fetch(`${origin}/api/dsh/whale-translator/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin, 'x-whale-translator-token': token },
      body: JSON.stringify({ text: 'Hello', source: 'auto', target: 'zh' }),
    })
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.ok, true)
    assert.equal(data.translation, '你好')
  })
})

test('route issues the live token to a same-origin GET', async () => {
  await withServer(async (origin, token) => {
    const response = await fetch(`${origin}/api/dsh/whale-translator/translate`, {
      method: 'GET',
      headers: { origin, accept: 'application/json' },
    })
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.ok, true)
    assert.equal(data.token, token)
  })
})

test('route rejects a cross-site token request', async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/dsh/whale-translator/translate`, {
      method: 'GET',
      headers: { origin: 'http://evil.test', accept: 'application/json' },
    })
    assert.equal(response.status, 403)
  })
})

test('route rejects a request without the page token', async () => {
  await withServer(async (origin, token) => {
    const missing = await fetch(`${origin}/api/dsh/whale-translator/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ text: 'Hello' }),
    })
    assert.equal(missing.status, 403)

    const wrong = await fetch(`${origin}/api/dsh/whale-translator/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin, 'x-whale-translator-token': `${token}x` },
      body: JSON.stringify({ text: 'Hello' }),
    })
    assert.equal(wrong.status, 403)
  })
})

test('route rejects a cross-site request', async () => {
  await withServer(async (origin, token) => {
    const response = await fetch(`${origin}/api/dsh/whale-translator/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://evil.test', 'x-whale-translator-token': token },
      body: JSON.stringify({ text: 'Hello' }),
    })
    assert.equal(response.status, 403)
  })
})

test('route rejects non-JSON content types and non-POST methods', async () => {
  await withServer(async (origin, token) => {
    const unsupported = await fetch(`${origin}/api/dsh/whale-translator/translate`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', origin, 'x-whale-translator-token': token },
      body: 'Hello',
    })
    assert.equal(unsupported.status, 415)

    const notAllowed = await fetch(`${origin}/api/dsh/whale-translator/translate`, {
      method: 'PUT',
      headers: { origin, 'x-whale-translator-token': token },
    })
    assert.equal(notAllowed.status, 405)
  })
})

test('route rejects an oversized declared body', async () => {
  await withServer(async (origin, token) => {
    const response = await fetch(`${origin}/api/dsh/whale-translator/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin, 'x-whale-translator-token': token },
      body: JSON.stringify({ text: 'Hello', padding: 'x'.repeat(100_000) }),
    })
    assert.equal(response.status, 413)
  })
})
