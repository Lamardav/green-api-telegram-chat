import { isObject, isString, str } from '../lib/guards'
import { classifyHttpError, classifyReason, GreenApiError } from './errors'
import type {
  CheckAccountResult,
  Credentials,
  FetchLike,
  GreenApiClient,
  InstanceSettings,
  ReceivedNotification,
  StateInstance,
} from './types'

type Method = 'GET' | 'POST' | 'DELETE'

type RequestOptions = {
  body?: unknown
  /** Appended after the token, e.g. `?receiveTimeout=20` or `/42`. */
  suffix?: string
  signal?: AbortSignal | undefined
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 15_000
/** A long poll may legitimately take `receiveTimeout`; allow that plus network slack. */
const LONG_POLL_SLACK_MS = 10_000

const badResponse = (method: string) =>
  new GreenApiError('badResponse', `Unexpected response from ${method}`)

/** Combines the caller's signal with a timeout; `dispose` must be called when the request settles. */
function withTimeout(parent: AbortSignal | undefined, ms: number) {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
    ms,
  )
  const forward = () => controller.abort(parent?.reason)
  if (parent?.aborted) forward()
  else parent?.addEventListener('abort', forward, { once: true })
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer)
      parent?.removeEventListener('abort', forward)
    },
  }
}

/**
 * Thin typed client over the GREEN-API REST methods used by the app.
 * `fetchImpl` is injectable so tests and the demo mode can run against an in-memory simulator.
 */
export function createGreenApiClient(
  creds: Credentials,
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): GreenApiClient {
  const root = `${creds.apiUrl}/waInstance${encodeURIComponent(creds.idInstance)}`
  const token = encodeURIComponent(creds.apiTokenInstance)

  async function request(method: Method, apiMethod: string, opts: RequestOptions = {}) {
    const url = `${root}/${apiMethod}/${token}${opts.suffix ?? ''}`
    const timeout = withTimeout(opts.signal, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    const init: RequestInit = { method, signal: timeout.signal }
    if (opts.body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' }
      init.body = JSON.stringify(opts.body)
    }

    let text: string
    try {
      const response = await fetchImpl(url, init)
      text = await response.text()
      if (!response.ok) throw classifyHttpError(response.status, text)
    } catch (err) {
      if (err instanceof GreenApiError) throw err
      // Never propagate the original error message: it may contain the URL with the token.
      if (opts.signal?.aborted) throw new GreenApiError('aborted', `${apiMethod} aborted`)
      throw new GreenApiError('network', `${apiMethod} failed: network error or timeout`)
    } finally {
      timeout.dispose()
    }

    if (text.trim() === '') return null
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw badResponse(apiMethod)
    }
  }

  return {
    async getStateInstance(signal) {
      const data = await request('GET', 'getStateInstance', { signal })
      if (!isObject(data) || !isString(data.stateInstance)) throw badResponse('getStateInstance')
      return data.stateInstance as StateInstance
    },

    async getSettings(signal): Promise<InstanceSettings> {
      const data = await request('GET', 'getSettings', { signal })
      if (!isObject(data)) throw badResponse('getSettings')
      return {
        webhookUrl: str(data.webhookUrl),
        incomingWebhook: str(data.incomingWebhook) || 'no',
        outgoingWebhook: str(data.outgoingWebhook) || 'no',
      }
    },

    async enableHttpNotifications(signal) {
      const data = await request('POST', 'setSettings', {
        signal,
        body: { webhookUrl: '', incomingWebhook: 'yes', outgoingWebhook: 'yes' },
      })
      if (!isObject(data) || data.saveSettings !== true) {
        throw new GreenApiError('badRequest', 'setSettings was not saved')
      }
    },

    async checkAccount(phoneDigits, signal): Promise<CheckAccountResult> {
      const data = await request('POST', 'checkAccount', {
        signal,
        body: { phoneNumber: Number(phoneDigits) },
      })
      if (!isObject(data)) throw badResponse('checkAccount')
      if (data.status === 'rate_limit_exceeded') {
        throw new GreenApiError('rateLimit', 'checkAccount rate limit exceeded')
      }
      if (data.status === false) throw classifyReason(str(data.reason))
      if (typeof data.exist !== 'boolean') throw badResponse('checkAccount')
      const chatId = isString(data.chatId) || typeof data.chatId === 'number'
      return { exist: data.exist, chatId: chatId ? String(data.chatId) : '' }
    },

    async sendMessage(chatId, message, signal) {
      const data = await request('POST', 'sendMessage', { signal, body: { chatId, message } })
      if (!isObject(data) || !isString(data.idMessage) || data.idMessage === '') {
        throw badResponse('sendMessage')
      }
      return { idMessage: data.idMessage }
    },

    async receiveNotification(timeoutSec, signal): Promise<ReceivedNotification | null> {
      const data = await request('GET', 'receiveNotification', {
        signal,
        suffix: `?receiveTimeout=${timeoutSec}`,
        timeoutMs: timeoutSec * 1000 + LONG_POLL_SLACK_MS,
      })
      if (data === null) return null
      if (!isObject(data) || typeof data.receiptId !== 'number') {
        throw badResponse('receiveNotification')
      }
      return { receiptId: data.receiptId, body: data.body }
    },

    async deleteNotification(receiptId, signal) {
      const data = await request('DELETE', 'deleteNotification', {
        signal,
        suffix: `/${receiptId}`,
      })
      if (!isObject(data) || typeof data.result !== 'boolean') {
        throw badResponse('deleteNotification')
      }
      return data.result
    },
  }
}

/** HTTP API receiving works only with an empty webhookUrl and the notification types enabled. */
export function settingsReady(s: InstanceSettings): boolean {
  return s.webhookUrl.trim() === '' && s.incomingWebhook === 'yes' && s.outgoingWebhook === 'yes'
}
