import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeLocks } from '../test/fakeLocks'
import { claimTab } from './tabLock'

let locks: ReturnType<typeof installFakeLocks>
beforeEach(() => {
  locks = installFakeLocks()
})
afterEach(() => locks.uninstall())

const settled = async (promise: Promise<unknown>) => {
  let done = false
  void promise.then(
    () => (done = true),
    () => (done = true),
  )
  await new Promise((r) => setTimeout(r, 0))
  return done
}

describe('claimTab', () => {
  it('grants a free lock and frees it on release', async () => {
    const claim = await claimTab('chat')
    expect(locks.isHeld('chat')).toBe(true)
    claim.release()
    await claim.lost
    expect(locks.isHeld('chat')).toBe(false)
  })

  it('waits while another tab holds the lock and gets it after release', async () => {
    const first = await claimTab('chat')
    const second = claimTab('chat')
    expect(await settled(second)).toBe(false)
    first.release()
    await expect(second).resolves.toHaveProperty('release')
  })

  it('stops waiting when aborted', async () => {
    await claimTab('chat')
    const controller = new AbortController()
    const waiting = claimTab('chat', { signal: controller.signal })
    controller.abort()
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('takes the lock over, and the previous owner learns it lost it', async () => {
    const first = await claimTab('chat')
    const lost = vi.fn()
    void first.lost.then(lost)
    const second = await claimTab('chat', { steal: true })
    await Promise.resolve()
    expect(lost).toHaveBeenCalled()
    expect(locks.isHeld('chat')).toBe(true)
    second.release()
  })

  it('treats every tab as owner without the Web Locks API', async () => {
    locks.uninstall()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const a = await claimTab('chat')
    const b = await claimTab('chat')
    expect(a).toHaveProperty('release')
    expect(b).toHaveProperty('release')
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1)
  })
})
