import test from 'node:test'
import assert from 'node:assert/strict'

test('client bundle registers the overlay into shell.overlay', async () => {
  let registration
  globalThis.window = {
    __ModuleLoader__: {
      load(value) {
        registration = value
      },
    },
  }

  try {
    await import('../client.js')
    assert.ok(registration, 'the bundle should register with the module loader')
    assert.equal(registration.id, '@local/whale-translator')

    const module = registration.factory((name) => {
      assert.equal(name, 'react')
      return { createElement: () => null }
    })
    assert.deepEqual(module.inject, ['slots'])

    let overlay
    module.apply({
      slots: {
        inject(name, callback) {
          assert.equal(name, 'shell.overlay')
          callback()
        },
        register(options, component) {
          overlay = { options, component }
          return () => undefined
        },
      },
    })
    assert.equal(overlay.options.id, 'whale-translator.overlay')
    assert.equal(overlay.options.name, 'shell.overlay')
    assert.equal(overlay.options.order, 45)
    assert.equal(typeof overlay.component, 'function')
  } finally {
    delete globalThis.window
  }
})
