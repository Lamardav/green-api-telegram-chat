import { useEffect, useState } from 'react'
import type { GreenApiError } from '../api/errors'
import type { DomainEvent } from '../api/notifications'
import type { GreenApiClient } from '../api/types'
import { runPoller, type PollerStatus } from '../services/poller'
import { useLatest } from './useLatest'

type Options = {
  client: GreenApiClient
  enabled: boolean
  onEvent(event: DomainEvent): void
  onFatal(error: GreenApiError): void
  isFatal(error: unknown): error is GreenApiError
}

/** Runs the notification poller while `enabled`; returns the connection state for the UI. */
export function useNotificationPoller({ client, enabled, ...callbacks }: Options): PollerStatus {
  const [connection, setConnection] = useState<PollerStatus>('ok')
  // Callbacks change on every render; the long-running loop must not restart because of that.
  const latest = useLatest(callbacks)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    runPoller({
      client,
      signal: controller.signal,
      onStatus: setConnection,
      onEvent: (event) => latest.current.onEvent(event),
      isFatal: (error): error is GreenApiError => latest.current.isFatal(error),
      onFatal: (error) => {
        setConnection('ok')
        latest.current.onFatal(error)
      },
    }).catch((err: unknown) => console.error('Notification polling stopped', err))
    return () => {
      controller.abort()
      setConnection('ok')
    }
  }, [client, enabled, latest])

  return connection
}
