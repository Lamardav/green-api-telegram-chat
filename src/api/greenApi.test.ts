import { describe, expect, it, vi } from 'vitest'
import { GreenApiError } from './errors'
import { createGreenApiClient, settingsReady } from './greenApi'
import type { FetchLike } from './types'

const creds = { idInstance: '4100000001', apiTokenInstance: 'TOKEN', apiUrl: 'https://h.test' }
const base = 'https://h.test/waInstance4100000001'

function fakeFetch(respond: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return vi.fn<FetchLike>(async (url, init) => respond(url, init))
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (err) {
    if (err instanceof GreenApiError) return err.kind
    throw err
  }
  throw new Error('expected rejection')
}

describe('sendMessage', () => {
  it('posts chatId and message and returns idMessage', async () => {
    const fetch = fakeFetch(() => json({ idMessage: 'M1' }))
    const client = createGreenApiClient(creds, fetch)

    await expect(client.sendMessage('10000001', 'hi')).resolves.toEqual({ idMessage: 'M1' })

    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe(`${base}/sendMessage/TOKEN`)
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ chatId: '10000001', message: 'hi' }))
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
    expect(init?.credentials).toBeUndefined()
  })

  it('rejects a response without idMessage', async () => {
    const client = createGreenApiClient(
      creds,
      fakeFetch(() => json({})),
    )
    expect(await kindOf(client.sendMessage('1', 'x'))).toBe('badResponse')
  })
})

describe('receiveNotification', () => {
  it('passes receiveTimeout and returns the notification', async () => {
    const fetch = fakeFetch(() => json({ receiptId: 7, body: { typeWebhook: 'x' } }))
    const client = createGreenApiClient(creds, fetch)

    await expect(client.receiveNotification(20)).resolves.toEqual({
      receiptId: 7,
      body: { typeWebhook: 'x' },
    })
    expect(fetch.mock.calls[0]![0]).toBe(`${base}/receiveNotification/TOKEN?receiveTimeout=20`)
    expect(fetch.mock.calls[0]![1]?.method).toBe('GET')
  })

  it('treats an empty body and a null body as an empty queue', async () => {
    const empty = createGreenApiClient(
      creds,
      fakeFetch(() => new Response('', { status: 200 })),
    )
    const nul = createGreenApiClient(
      creds,
      fakeFetch(() => new Response('null', { status: 200 })),
    )
    await expect(empty.receiveNotification(5)).resolves.toBeNull()
    await expect(nul.receiveNotification(5)).resolves.toBeNull()
  })

  it('rejects malformed JSON', async () => {
    const client = createGreenApiClient(
      creds,
      fakeFetch(() => new Response('{oops', { status: 200 })),
    )
    expect(await kindOf(client.receiveNotification(5))).toBe('badResponse')
  })
})

describe('deleteNotification', () => {
  it('sends DELETE with the receipt id in the path', async () => {
    const fetch = fakeFetch(() => json({ result: true }))
    const client = createGreenApiClient(creds, fetch)

    await expect(client.deleteNotification(42)).resolves.toBe(true)
    expect(fetch.mock.calls[0]![0]).toBe(`${base}/deleteNotification/TOKEN/42`)
    expect(fetch.mock.calls[0]![1]?.method).toBe('DELETE')
  })
})

describe('checkAccount', () => {
  it('sends phoneNumber as a number and returns chatId', async () => {
    const fetch = fakeFetch(() => json({ exist: true, chatId: '10000001' }))
    const client = createGreenApiClient(creds, fetch)

    await expect(client.checkAccount('79991234567')).resolves.toEqual({
      exist: true,
      chatId: '10000001',
    })
    expect(fetch.mock.calls[0]![1]?.body).toBe('{"phoneNumber":79991234567}')
  })

  it('maps a status:false body to a typed error', async () => {
    const client = createGreenApiClient(
      creds,
      fakeFetch(() => json({ status: false, reason: 'instance is starting or not authorized' })),
    )
    expect(await kindOf(client.checkAccount('79991234567'))).toBe('notAuthorized')
  })

  it('maps rate_limit_exceeded to rateLimit', async () => {
    const client = createGreenApiClient(
      creds,
      fakeFetch(() => json({ status: 'rate_limit_exceeded', retryAfter: 7200 })),
    )
    expect(await kindOf(client.checkAccount('79991234567'))).toBe('rateLimit')
  })
})

describe('instance methods', () => {
  it('reads stateInstance', async () => {
    const fetch = fakeFetch(() => json({ stateInstance: 'authorized' }))
    await expect(createGreenApiClient(creds, fetch).getStateInstance()).resolves.toBe('authorized')
    expect(fetch.mock.calls[0]![0]).toBe(`${base}/getStateInstance/TOKEN`)
  })

  it('reads settings with safe defaults', async () => {
    const fetch = fakeFetch(() => json({ webhookUrl: null, incomingWebhook: 'yes' }))
    await expect(createGreenApiClient(creds, fetch).getSettings()).resolves.toEqual({
      webhookUrl: '',
      incomingWebhook: 'yes',
      outgoingWebhook: 'no',
    })
  })

  it('enables HTTP API notifications', async () => {
    const fetch = fakeFetch(() => json({ saveSettings: true }))
    await createGreenApiClient(creds, fetch).enableHttpNotifications()
    expect(fetch.mock.calls[0]![0]).toBe(`${base}/setSettings/TOKEN`)
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual({
      webhookUrl: '',
      incomingWebhook: 'yes',
      outgoingWebhook: 'yes',
    })
  })
})

describe('error classification', () => {
  it.each([
    [401, 'Unauthorized', 'unauthorized'],
    [403, 'Forbidden', 'unauthorized'],
    [400, 'Message cannot be received because custom webhook url is set', 'webhookSet'],
    [400, 'instance is starting or not authorized', 'notAuthorized'],
    [400, 'Validation failed', 'badRequest'],
    [466, '{"invokeStatus":{}}', 'quota'],
    [429, 'Too Many Requests', 'rateLimit'],
    [502, 'Bad Gateway', 'server'],
  ])('HTTP %i → %s', async (status, body, kind) => {
    const client = createGreenApiClient(
      creds,
      fakeFetch(() => new Response(body, { status })),
    )
    const error = await client.getStateInstance().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(GreenApiError)
    expect((error as GreenApiError).kind).toBe(kind)
    expect((error as GreenApiError).status).toBe(status)
  })

  it('maps a thrown fetch to network', async () => {
    const client = createGreenApiClient(
      creds,
      fakeFetch(() => {
        throw new TypeError('Failed to fetch')
      }),
    )
    expect(await kindOf(client.getStateInstance())).toBe('network')
  })

  it('maps an aborted request to aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const client = createGreenApiClient(
      creds,
      fakeFetch(() => {
        throw new DOMException('aborted', 'AbortError')
      }),
    )
    expect(await kindOf(client.getStateInstance(controller.signal))).toBe('aborted')
  })

  it('never leaks the token into error messages', async () => {
    const client = createGreenApiClient(
      creds,
      fakeFetch(() => {
        throw new TypeError(`Failed to fetch ${base}/getStateInstance/TOKEN`)
      }),
    )
    const error = (await client.getStateInstance().catch((e: unknown) => e)) as Error
    expect(error.message).not.toContain('TOKEN')
  })
})

describe('settingsReady', () => {
  it('requires empty webhookUrl and both notification types', () => {
    const ok = { webhookUrl: '', incomingWebhook: 'yes', outgoingWebhook: 'yes' }
    expect(settingsReady(ok)).toBe(true)
    expect(settingsReady({ ...ok, webhookUrl: 'https://x' })).toBe(false)
    expect(settingsReady({ ...ok, incomingWebhook: 'no' })).toBe(false)
    expect(settingsReady({ ...ok, outgoingWebhook: 'no' })).toBe(false)
  })
})
