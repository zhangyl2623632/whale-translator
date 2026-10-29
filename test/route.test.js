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
        },
      })
    },
  }
  apply(ctx)
  assert.ok(route, 'apply() should register a web route')
  return route
}

async function withServer(run) {
  const route = captureRoute()
  const server = http.createServer((req, res) => {
    void route.handler(req, res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try {
    await run(`http://127.0.0.1:${port}`)
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
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/dsh/whale-translator/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ text: 'Hello', source: 'auto', target: 'zh' }),
    })
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(data.ok, true)
    assert.equal(data.translation, '你好')
  })
})

test('route rejects a cross-site request', async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/dsh/whale-translator/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://evil.test' },
      body: JSON.stringify({ text: 'Hello' }),
    })
    assert.equal(response.status, 403)
  })
})

test('route rejects non-JSON content types and non-POST methods', async () => {
  await withServer(async (origin) => {
    const unsupported = await fetch(`${origin}/api/dsh/whale-translator/translate`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', origin },
      body: 'Hello',
    })
    assert.equal(unsupported.status, 415)

    const notAllowed = await fetch(`${origin}/api/dsh/whale-translator/translate`, {
      method: 'GET',
      headers: { origin },
    })
    assert.equal(notAllowed.status, 405)
  })
})

test('route rejects an oversized declared body', async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/api/dsh/whale-translator/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ text: 'Hello', padding: 'x'.repeat(100_000) }),
    })
    assert.equal(response.status, 413)
  })
})
