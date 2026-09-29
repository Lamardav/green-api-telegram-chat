/**
 * Runs `fn` while holding an exclusive cross-tab lock, so only one tab consumes the
 * notification queue (two pollers would split messages between tabs).
 * Falls back to running directly where the Web Locks API is unavailable.
 */
export async function runExclusive(
  name: string,
  fn: (signal: AbortSignal) => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  if (!locks) return fn(signal)
  try {
    await locks.request(name, { signal }, () => fn(signal))
  } catch (err) {
    if (signal.aborted) return
    throw err
  }
}
