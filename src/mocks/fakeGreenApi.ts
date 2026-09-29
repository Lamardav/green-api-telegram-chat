import type { FetchLike, InstanceSettings, StateInstance } from '../api/types'

/**
 * In-memory GREEN-API (Telegram) simulator implementing `fetch`.
 * Used by component tests and by `npm run dev:mock`; never bundled into production.
 */

export const FAKE_ID_INSTANCE = '1101000001'
export const FAKE_TOKEN = 'test-token'
export const FAKE_PHONE = '79990000001'
export const FAKE_CHAT_ID = '10000001'
export const FAKE_CONTACT_NAME = 'Анна (демо)'

export type FakeOptions = {
  /** The simulated recipient answers every message. */
  autoReply?: boolean
  replyDelayMs?: number
  statusDelayMs?: number
  settingsReady?: boolean
  state?: StateInstance
  /** Upper bound for how long an empty receiveNotification waits (real API: receiveTimeout). */
  maxReceiveWaitMs?: number
}

type Queued = { receiptId: number; body: unknown }
type Failure = { status: number; body: string }

export type FakeGreenApi = ReturnType<typeof createFakeGreenApi>

const ROUTE = /\/waInstance(\d+)\/(\w+)\/([^/?]+)(?:\/(\d+))?/

export function createFakeGreenApi(options: FakeOptions = {}) {
  const {
    autoReply = false,
    replyDelayMs = 1500,
    statusDelayMs = 300,
    settingsReady = true,
    state = 'authorized',
    maxReceiveWaitMs = 1000,
  } = options

  const settings: InstanceSettings = settingsReady
    ? { webhookUrl: '', incomingWebhook: 'yes', outgoingWebhook: 'yes' }
    : { webhookUrl: 'https://example.com/hook', incomingWebhook: 'no', outgoingWebhook: 'no' }
  const accounts = new Map<string, string>([[FAKE_PHONE, FAKE_CHAT_ID]])
  const names = new Map<string, string>([[FAKE_CHAT_ID, FAKE_CONTACT_NAME]])
  const queue: Queued[] = []
  const sent: Array<{ chatId: string; message: string; idMessage: string }> = []
  const calls: string[] = []
  const failures = new Map<string, Failure[]>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let waiters: Array<() => void> = []
  let nextReceipt = 1
  let nextId = 1

  const later = (ms: number, fn: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      fn()
    }, ms)
    timers.add(timer)
  }

  const enqueue = (body: unknown) => {
    queue.push({ receiptId: nextReceipt++, body })
    const pending = waiters
    waiters = []
    pending.forEach((wake) => wake())
  }

  const instanceData = {
    idInstance: Number(FAKE_ID_INSTANCE),
    wid: '79990009999@c.us',
    typeInstance: 'telegram',
  }

  function pushIncoming(chatId: string, text: string, senderName = names.get(chatId) ?? chatId) {
    if (settings.incomingWebhook !== 'yes') return
    enqueue({
      typeWebhook: 'incomingMessageReceived',
      instanceData,
      timestamp: Math.floor(Date.now() / 1000),
      idMessage: `IN${nextId++}`,
      senderData: {
        chatId,
        chatType: 'user',
        sender: chatId,
        chatName: senderName,
        senderName,
        senderType: 'user',
        senderContactName: senderName,
        senderPhoneNumber: 0,
      },
      messageData: {
        typeMessage: 'textMessage',
        textMessageData: { textMessage: text, forwardingScore: 0, isForwarded: false },
      },
    })
  }

  function pushStatus(chatId: string, idMessage: string, status: string) {
    if (settings.outgoingWebhook !== 'yes') return
    enqueue({
      typeWebhook: 'outgoingMessageStatus',
      chatId,
      instanceData,
      timestamp: Math.floor(Date.now() / 1000),
      idMessage,
      status,
    })
  }

  /** Makes the next call(s) to `method` fail with the given HTTP status. */
  function failNext(method: string, status: number, body = '', times = 1) {
    const list = failures.get(method) ?? []
    for (let i = 0; i < times; i++) list.push({ status, body })
    failures.set(method, list)
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

  const abortError = () => new DOMException('The operation was aborted.', 'AbortError')

  function waitForQueue(ms: number, signal: AbortSignal | null | undefined) {
    return new Promise<void>((resolve, reject) => {
      const wake = () => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }
      const onAbort = () => {
        clearTimeout(timer)
        waiters = waiters.filter((w) => w !== wake)
        reject(abortError())
      }
      const timer = setTimeout(wake, ms)
      waiters.push(wake)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  const body = (init?: RequestInit): Record<string, unknown> => {
    try {
      return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  const fetch: FetchLike = async (input, init) => {
    if (init?.signal?.aborted) throw abortError()
    const match = ROUTE.exec(input)
    if (!match) return new Response('Not Found', { status: 404 })
    const [, id, method = '', token, receipt] = match
    calls.push(method)

    const failure = failures.get(method)?.shift()
    if (failure) {
      // Status 0 simulates a network failure, like a real fetch rejecting.
      if (failure.status === 0) throw new TypeError('Failed to fetch')
      return new Response(failure.body, { status: failure.status })
    }
    if (token !== FAKE_TOKEN) return new Response('Unauthorized', { status: 401 })
    if (id !== FAKE_ID_INSTANCE) return new Response('Forbidden', { status: 403 })

    switch (method) {
      case 'getStateInstance':
        return json({ stateInstance: state })

      case 'getSettings':
        return json({ ...settings, typeInstance: 'telegram' })

      case 'setSettings':
        Object.assign(settings, body(init))
        return json({ saveSettings: true })

      case 'checkAccount': {
        const phone = String(body(init).phoneNumber ?? '')
        const chatId = accounts.get(phone)
        return json(
          chatId
            ? { exist: true, chatId, phoneNumber: Number(phone) }
            : { exist: false, chatId: '' },
        )
      }

      case 'sendMessage': {
        const { chatId, message } = body(init)
        if (typeof chatId !== 'string' || typeof message !== 'string' || message.length > 4096) {
          return new Response('Bad Request Validation failed', { status: 400 })
        }
        const idMessage = `OUT${nextId++}`
        sent.push({ chatId, message, idMessage })
        later(statusDelayMs, () => pushStatus(chatId, idMessage, 'delivered'))
        if (autoReply) {
          later(Math.max(statusDelayMs * 2, replyDelayMs / 2), () =>
            pushStatus(chatId, idMessage, 'read'),
          )
          later(replyDelayMs, () => pushIncoming(chatId, `Эхо: ${message}`))
        }
        return json({ idMessage })
      }

      case 'receiveNotification': {
        if (settings.webhookUrl !== '') {
          return new Response(
            'Message cannot be received because custom webhook url is set. Go to cabinet, clear webhook url',
            { status: 400 },
          )
        }
        if (queue.length === 0) {
          const seconds = Number(new URL(input).searchParams.get('receiveTimeout') ?? 5)
          await waitForQueue(Math.min(seconds * 1000, maxReceiveWaitMs), init?.signal)
        }
        const head = queue[0]
        return head ? json(head) : new Response('null', { status: 200 })
      }

      case 'deleteNotification': {
        const index = queue.findIndex((q) => q.receiptId === Number(receipt))
        if (index !== -1) queue.splice(index, 1)
        return json({ result: index !== -1 })
      }

      default:
        return new Response('Not Found', { status: 404 })
    }
  }

  function dispose() {
    timers.forEach(clearTimeout)
    timers.clear()
    const pending = waiters
    waiters = []
    pending.forEach((wake) => wake())
  }

  return {
    fetch,
    settings,
    accounts,
    names,
    queue,
    sent,
    calls,
    pushIncoming,
    pushStatus,
    pushRaw: enqueue,
    failNext,
    dispose,
  }
}
