/**
 * Minimal in-memory LockManager with the semantics the app relies on:
 * exclusive locks, FIFO waiting, abort while waiting, and `steal`.
 */
export function installFakeLocks() {
  type Holder = { onStolen(): void }
  const held = new Map<string, Holder>()
  const waiting = new Map<string, Array<() => void>>()

  const grantNext = (name: string) => waiting.get(name)?.shift()?.()

  const request = (name: string, options: LockOptions, callback: () => unknown) =>
    new Promise((resolve, reject) => {
      const run = () => {
        let settled = false
        const settle = (fn: () => void) => {
          if (!settled) {
            settled = true
            fn()
          }
        }
        const holder: Holder = {
          onStolen: () => settle(() => reject(new DOMException('Lock stolen', 'AbortError'))),
        }
        held.set(name, holder)
        const releaseIfStillHeld = () => {
          if (held.get(name) !== holder) return
          held.delete(name)
          grantNext(name)
        }
        Promise.resolve()
          .then(callback)
          .then(
            (value) => {
              releaseIfStillHeld()
              settle(() => resolve(value))
            },
            (error: unknown) => {
              releaseIfStillHeld()
              settle(() => reject(error))
            },
          )
      }

      if (options.steal) {
        held.get(name)?.onStolen()
        held.delete(name)
        run()
        return
      }
      if (options.signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      if (!held.has(name)) {
        run()
        return
      }
      const queue = waiting.get(name) ?? []
      waiting.set(name, queue)
      const entry = () => run()
      queue.push(entry)
      options.signal?.addEventListener(
        'abort',
        () => {
          const index = queue.indexOf(entry)
          if (index === -1) return
          queue.splice(index, 1)
          reject(new DOMException('Aborted', 'AbortError'))
        },
        { once: true },
      )
    })

  Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true })
  return {
    isHeld: (name: string) => held.has(name),
    uninstall: () =>
      Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true }),
  }
}
