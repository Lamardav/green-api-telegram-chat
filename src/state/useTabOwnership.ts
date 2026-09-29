import { useCallback, useEffect, useState } from 'react'
import { claimTab, type TabClaim } from '../services/tabLock'

export type Ownership = 'pending' | 'owner' | 'elsewhere'

/**
 * How long to wait for the lock before telling the user another tab has it. Covers the brief
 * hand-over when this tab re-mounts (StrictMode, fast refresh) and still holds it for a moment.
 */
const HANDOVER_GRACE_MS = 400

/**
 * Only one tab per instance may consume the notification queue and write the history.
 * A tab that is not the owner keeps waiting in line and becomes the owner automatically when
 * the other tab closes; `takeOver` moves ownership here immediately.
 */
export function useTabOwnership(lockName: string) {
  const [status, setStatus] = useState<Ownership>('pending')
  /** Increments on every acquisition, so owners can remount with fresh state. */
  const [epoch, setEpoch] = useState(0)
  const [attempt, setAttempt] = useState({ steal: false, run: 0 })

  useEffect(() => {
    const controller = new AbortController()
    let claim: TabClaim | null = null
    let disposed = false

    const grace = setTimeout(() => {
      setStatus((s) => (s === 'pending' ? 'elsewhere' : s))
    }, HANDOVER_GRACE_MS)

    claimTab(lockName, { signal: controller.signal, steal: attempt.steal }).then(
      (granted) => {
        if (disposed) return granted.release()
        claim = granted
        clearTimeout(grace)
        setEpoch((n) => n + 1)
        setStatus('owner')
        void granted.lost.then(() => {
          if (disposed) return
          setStatus('elsewhere')
          // Queue up again: ownership comes back once the other tab closes.
          setAttempt((a) => ({ steal: false, run: a.run + 1 }))
        })
      },
      () => {
        // Aborted while waiting: this effect run is over.
      },
    )

    return () => {
      disposed = true
      clearTimeout(grace)
      controller.abort()
      claim?.release()
    }
  }, [lockName, attempt])

  const takeOver = useCallback(() => setAttempt((a) => ({ steal: true, run: a.run + 1 })), [])

  return { status, epoch, takeOver }
}
