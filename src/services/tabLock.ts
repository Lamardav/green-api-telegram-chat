export type TabClaim = {
  /** Resolves once the lock is gone: released by this tab or taken over by another one. */
  lost: Promise<void>
  release(): void
}

type ClaimOptions = {
  /** Stop waiting for the lock (ignored with `steal`, which never waits). */
  signal?: AbortSignal
  /** Take the lock from whichever tab holds it now. */
  steal?: boolean
}

let warnedUnsupported = false

/**
 * Claims the exclusive cross-tab lock `name` using the Web Locks API.
 * Resolves when the lock is granted; rejects if `signal` aborts while waiting.
 *
 * Without the API (e.g. an insecure http:// origin) tabs cannot coordinate, so every tab is
 * treated as the owner.
 */
export function claimTab(name: string, { signal, steal = false }: ClaimOptions = {}) {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  if (!locks) {
    if (!warnedUnsupported) {
      console.warn('Web Locks API is unavailable: several tabs may read the same queue')
      warnedUnsupported = true
    }
    return Promise.resolve<TabClaim>({ lost: new Promise(() => {}), release: () => {} })
  }

  return new Promise<TabClaim>((resolve, reject) => {
    let release: () => void = () => {}
    const held = new Promise<void>((done) => (release = done))
    // The spec forbids combining `steal` with `signal`.
    const options: LockOptions = steal ? { steal: true } : signal ? { signal } : {}
    const request = locks.request(name, options, () => {
      resolve({ lost, release })
      return held
    })
    // The request settles when the lock is released, or rejects with AbortError when stolen.
    const lost = request.then(
      () => undefined,
      () => undefined,
    )
    request.catch(reject)
  })
}
