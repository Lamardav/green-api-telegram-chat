import { describe, expect, it, vi } from 'vitest'
import { GreenApiError } from '../api/errors'
import type { DomainEvent } from '../api/notifications'
import type { ReceivedNotification } from '../api/types'
import { abortableSleep, backoffDelay, runPoller, type PollerOptions } from './poller'

type Step = ReceivedNotification | null | GreenApiError | Error

const textBody = (idMessage: string) => ({
  typeWebhook: 'incomingMessageReceived',
  idMessage,
  timestamp: 1,
  senderData: { chatId: '1', chatType: 'user', senderName: 'A' },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: `t-${idMessage}` } },
})

/**
 * Builds a poller whose client replays `receives` in order, then aborts.
 * Returns a shared call log so ordering across receive/event/delete can be asserted.
 */
function setup(
  receives: Step[],
  deletes: Array<boolean | GreenApiError> = [],
  extra: Partial<PollerOptions> = {},
) {
  const controller = new AbortController()
  const log: string[] = []
  const delays: number[] = []
  const events: DomainEvent[] = []
  let r = 0
  let d = 0
  const client = {
    receiveNotification: vi.fn(async () => {
      if (r >= receives.length) {
        controller.abort()
        throw new GreenApiError('aborted', 'done')
      }
      const step = receives[r++]!
      log.push('receive')
      if (step instanceof Error) throw step
      return step
    }),
    deleteNotification: vi.fn(async (receiptId: number) => {
      log.push(`delete:${receiptId}`)
      const step = deletes[d++] ?? true
      if (step instanceof Error) throw step
      return step
    }),
  }
  const options: PollerOptions = {
    client,
    signal: controller.signal,
    onEvent: (e) => {
      log.push(`event:${e.type}`)
      events.push(e)
    },
    onFatal: vi.fn(),
    onStatus: vi.fn(),
    sleep: async (ms) => {
      delays.push(ms)
    },
    random: () => 0.5,
    now: () => 0,
    ...extra,
  }
  return { options, client, log, delays, events, controller }
}

const note = (receiptId: number, body: unknown = textBody(`m${receiptId}`)) => ({ receiptId, body })

describe('runPoller', () => {
  it('handles each notification before acknowledging it', async () => {
    const { options, log, events } = setup([note(1), note(2)])
    await runPoller(options)
    expect(log).toEqual([
      'receive',
      'event:incomingText',
      'delete:1',
      'receive',
      'event:incomingText',
      'delete:2',
    ])
    expect(events.map((e) => e.type === 'incomingText' && e.text)).toEqual(['t-m1', 't-m2'])
  })

  it('passes the receive timeout', async () => {
    const { options, client } = setup([null])
    await runPoller({ ...options, receiveTimeoutSec: 20 })
    expect(client.receiveNotification).toHaveBeenCalledWith(20, options.signal)
  })

  it('acknowledges ignored notifications too', async () => {
    const { options, log } = setup([note(5, { typeWebhook: 'stateInstanceChanged' })])
    await runPoller(options)
    expect(log).toEqual(['receive', 'event:ignored', 'delete:5'])
  })

  it('keeps polling on an empty queue without deleting', async () => {
    const { options, log } = setup([null, null, note(1)])
    await runPoller(options)
    expect(log).toEqual(['receive', 'receive', 'receive', 'event:incomingText', 'delete:1'])
  })

  it('throttles an empty queue that answers instantly', async () => {
    const { options, delays } = setup([null, null])
    await runPoller(options)
    expect(delays).toEqual([1000, 1000])
  })

  it('does not throttle when the long poll actually waited', async () => {
    let t = 0
    const { options, delays } = setup([null, null], [], { now: () => (t += 5000) })
    await runPoller(options)
    expect(delays).toEqual([])
  })

  it('backs off on transient errors and reports recovery', async () => {
    const { options, delays, log } = setup([
      new GreenApiError('network', 'x'),
      new GreenApiError('server', 'x', 502),
      note(1),
    ])
    await runPoller(options)
    expect(delays).toEqual([backoffDelay(0, () => 0.5), backoffDelay(1, () => 0.5)])
    expect(options.onStatus).toHaveBeenNthCalledWith(1, 'retrying')
    expect(options.onStatus).toHaveBeenNthCalledWith(2, 'ok')
    expect(options.onStatus).toHaveBeenCalledTimes(2)
    expect(log).toContain('delete:1')
  })

  it('treats unexpected exceptions as transient', async () => {
    const { options, log } = setup([new Error('bug'), note(1)])
    await runPoller(options)
    expect(log).toContain('delete:1')
    expect(options.onFatal).not.toHaveBeenCalled()
  })

  it('retries a failed delete, then moves on', async () => {
    const { options, log } = setup(
      [note(1)],
      [
        new GreenApiError('network', 'x'),
        new GreenApiError('network', 'x'),
        new GreenApiError('network', 'x'),
      ],
    )
    await runPoller(options)
    expect(log).toEqual(['receive', 'event:incomingText', 'delete:1', 'delete:1', 'delete:1'])
  })

  it('still acknowledges a notification whose handler throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { options, log } = setup([note(1)], [], {
      onEvent: () => {
        throw new Error('handler bug')
      },
    })
    await runPoller(options)
    expect(log).toEqual(['receive', 'delete:1'])
    expect(error).toHaveBeenCalled()
  })

  it.each(['unauthorized', 'webhookSet'] as const)('stops on fatal %s', async (kind) => {
    const fatal = new GreenApiError(kind, 'x', kind === 'unauthorized' ? 401 : 400)
    const { options, client } = setup([fatal, note(1)])
    await runPoller(options)
    expect(options.onFatal).toHaveBeenCalledWith(fatal)
    expect(client.receiveNotification).toHaveBeenCalledTimes(1)
  })

  it('stops on a fatal delete error', async () => {
    const fatal = new GreenApiError('unauthorized', 'x', 401)
    const { options, client } = setup([note(1), note(2)], [fatal])
    await runPoller(options)
    expect(options.onFatal).toHaveBeenCalledWith(fatal)
    expect(client.receiveNotification).toHaveBeenCalledTimes(1)
  })

  it('returns immediately when already aborted', async () => {
    const { options, client, controller } = setup([note(1)])
    controller.abort()
    await runPoller(options)
    expect(client.receiveNotification).not.toHaveBeenCalled()
    expect(options.onFatal).not.toHaveBeenCalled()
  })
})

describe('abortableSleep', () => {
  it('resolves after the delay or as soon as the signal aborts', async () => {
    vi.useFakeTimers()
    try {
      const done = vi.fn()
      void abortableSleep(1000, new AbortController().signal).then(done)
      await vi.advanceTimersByTimeAsync(999)
      expect(done).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(done).toHaveBeenCalled()

      const controller = new AbortController()
      const aborted = vi.fn()
      void abortableSleep(60_000, controller.signal).then(aborted)
      controller.abort()
      await vi.advanceTimersByTimeAsync(0)
      expect(aborted).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('backoffDelay', () => {
  it('grows exponentially with ±20% jitter and caps at 30s', () => {
    expect(backoffDelay(0, () => 0.5)).toBe(1000)
    expect(backoffDelay(1, () => 0.5)).toBe(2000)
    expect(backoffDelay(3, () => 0.5)).toBe(8000)
    expect(backoffDelay(0, () => 0)).toBe(800)
    expect(backoffDelay(0, () => 1)).toBe(1200)
    expect(backoffDelay(10, () => 1)).toBe(30000)
    expect(backoffDelay(50, () => 0)).toBe(24000)
  })
})
