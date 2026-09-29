import { GreenApiError, isGreenApiError } from '../api/errors'
import { parseNotification, type DomainEvent } from '../api/notifications'
import type { GreenApiClient } from '../api/types'

export type PollerStatus = 'ok' | 'retrying'

export type PollerOptions = {
  client: Pick<GreenApiClient, 'receiveNotification' | 'deleteNotification'>
  /** Must apply the event synchronously: the notification is deleted right after it returns. */
  onEvent: (event: DomainEvent) => void
  /** Errors that polling cannot recover from (bad credentials, webhook configured). */
  onFatal: (error: GreenApiError) => void
  onStatus?: (status: PollerStatus) => void
  signal: AbortSignal
  receiveTimeoutSec?: number
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
  random?: () => number
  now?: () => number
}

const MAX_DELAY_MS = 30_000
const MIN_EMPTY_POLL_MS = 1_000
const DELETE_ATTEMPTS = 3

export function backoffDelay(attempt: number, random: () => number): number {
  const base = Math.min(MAX_DELAY_MS, 1000 * 2 ** Math.min(attempt, 15))
  const jittered = base * (0.8 + 0.4 * random())
  return Math.round(Math.min(MAX_DELAY_MS, jittered))
}

export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
  })
}

const isFatal = (err: unknown): err is GreenApiError =>
  isGreenApiError(err, 'unauthorized') || isGreenApiError(err, 'webhookSet')

class Stop extends Error {}

/**
 * Consumes the GREEN-API notification queue until aborted or a fatal error occurs.
 *
 * Delivery is at-least-once: a notification is deleted only after `onEvent` has handled it,
 * so a crash in between re-delivers it and the reducer de-duplicates by idMessage.
 */
export async function runPoller(options: PollerOptions): Promise<void> {
  const {
    client,
    onEvent,
    onFatal,
    onStatus,
    signal,
    receiveTimeoutSec = 20,
    sleep = abortableSleep,
    random = Math.random,
    now = Date.now,
  } = options

  let failures = 0

  const recovered = () => {
    if (failures > 0) onStatus?.('ok')
    failures = 0
  }

  /** Waits after a failure; throws Stop when the loop must end. */
  const handleFailure = async (err: unknown) => {
    if (signal.aborted || isGreenApiError(err, 'aborted')) throw new Stop()
    if (isFatal(err)) {
      onFatal(err)
      throw new Stop()
    }
    if (failures === 0) onStatus?.('retrying')
    await sleep(backoffDelay(failures++, random), signal)
  }

  const acknowledge = async (receiptId: number) => {
    for (let attempt = 1; attempt <= DELETE_ATTEMPTS; attempt++) {
      try {
        await client.deleteNotification(receiptId, signal)
        recovered()
        return
      } catch (err) {
        if (attempt === DELETE_ATTEMPTS && !isFatal(err) && !signal.aborted) return // redelivery is harmless
        await handleFailure(err)
      }
    }
  }

  try {
    while (!signal.aborted) {
      let notification
      const startedAt = now()
      try {
        notification = await client.receiveNotification(receiveTimeoutSec, signal)
      } catch (err) {
        await handleFailure(err)
        continue
      }
      recovered()

      if (notification === null) {
        // Guard against a server that answers "empty" instantly instead of long-polling.
        if (now() - startedAt < MIN_EMPTY_POLL_MS) await sleep(MIN_EMPTY_POLL_MS, signal)
        continue
      }

      try {
        onEvent(parseNotification(notification.body))
      } catch (err) {
        // A handler bug must not block the queue with a poison notification.
        console.error('Failed to handle GREEN-API notification', err)
      }
      await acknowledge(notification.receiptId)
    }
  } catch (err) {
    if (!(err instanceof Stop)) throw err
  }
}
