import { afterEach, describe, expect, it, vi } from 'vitest'
import { runExclusive } from './tabLock'

const setLocks = (value: unknown) =>
  Object.defineProperty(navigator, 'locks', { value, configurable: true })

afterEach(() => {
  setLocks(undefined)
})

describe('runExclusive', () => {
  it('runs directly when the Web Locks API is unavailable', async () => {
    setLocks(undefined)
    const fn = vi.fn(async () => {})
    const controller = new AbortController()
    await runExclusive('lock', fn, controller.signal)
    expect(fn).toHaveBeenCalledWith(controller.signal)
  })

  it('runs inside the named lock when available', async () => {
    const request = vi.fn(async (_name: string, _opts: unknown, cb: () => Promise<void>) => cb())
    setLocks({ request })
    const fn = vi.fn(async () => {})
    const controller = new AbortController()
    await runExclusive('gac-poller-1', fn, controller.signal)
    expect(request).toHaveBeenCalledWith(
      'gac-poller-1',
      { signal: controller.signal },
      expect.any(Function),
    )
    expect(fn).toHaveBeenCalledOnce()
  })

  it('resolves quietly when aborted while waiting for the lock', async () => {
    const controller = new AbortController()
    setLocks({
      request: () => {
        controller.abort()
        return Promise.reject(new DOMException('aborted', 'AbortError'))
      },
    })
    await expect(runExclusive('lock', async () => {}, controller.signal)).resolves.toBeUndefined()
  })

  it('propagates other failures', async () => {
    setLocks({ request: () => Promise.reject(new Error('boom')) })
    await expect(
      runExclusive('lock', async () => {}, new AbortController().signal),
    ).rejects.toThrow('boom')
  })
})
