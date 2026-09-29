import { afterEach, describe, expect, it } from 'vitest'
import { GreenApiError } from '../api/errors'
import { createGreenApiClient, settingsReady } from '../api/greenApi'
import { parseNotification } from '../api/notifications'
import {
  createFakeGreenApi,
  FAKE_CHAT_ID,
  FAKE_ID_INSTANCE,
  FAKE_PHONE,
  FAKE_TOKEN,
  type FakeGreenApi,
} from './fakeGreenApi'

// These tests pin the simulator to the real client, so the two cannot drift apart.

let fake: FakeGreenApi
afterEach(() => fake?.dispose())

const creds = {
  idInstance: FAKE_ID_INSTANCE,
  apiTokenInstance: FAKE_TOKEN,
  apiUrl: 'https://1101.api.green-api.com',
}

describe('fake GREEN-API', () => {
  it('rejects a wrong token', async () => {
    fake = createFakeGreenApi()
    const client = createGreenApiClient({ ...creds, apiTokenInstance: 'nope' }, fake.fetch)
    await expect(client.getStateInstance()).rejects.toMatchObject({ kind: 'unauthorized' })
  })

  it('resolves the demo phone to a chatId', async () => {
    fake = createFakeGreenApi()
    const client = createGreenApiClient(creds, fake.fetch)
    await expect(client.checkAccount(FAKE_PHONE)).resolves.toEqual({
      exist: true,
      chatId: FAKE_CHAT_ID,
    })
    await expect(client.checkAccount('79990009998')).resolves.toEqual({ exist: false, chatId: '' })
  })

  it('reports unready settings and fixes them', async () => {
    fake = createFakeGreenApi({ settingsReady: false })
    const client = createGreenApiClient(creds, fake.fetch)
    expect(settingsReady(await client.getSettings())).toBe(false)
    await expect(client.receiveNotification(5)).rejects.toMatchObject({ kind: 'webhookSet' })
    await client.enableHttpNotifications()
    expect(settingsReady(await client.getSettings())).toBe(true)
  })

  it('delivers statuses and an echo reply through the queue', async () => {
    fake = createFakeGreenApi({ autoReply: true, replyDelayMs: 30, statusDelayMs: 5 })
    const client = createGreenApiClient(creds, fake.fetch)
    const { idMessage } = await client.sendMessage(FAKE_CHAT_ID, 'Привет')

    const events = []
    while (events.length < 3) {
      const n = await client.receiveNotification(5)
      if (!n) continue
      events.push(parseNotification(n.body))
      await client.deleteNotification(n.receiptId)
    }
    expect(events).toEqual([
      expect.objectContaining({ type: 'outgoingStatus', idMessage, status: 'delivered' }),
      expect.objectContaining({ type: 'outgoingStatus', idMessage, status: 'read' }),
      expect.objectContaining({ type: 'incomingText', chatId: FAKE_CHAT_ID, text: 'Эхо: Привет' }),
    ])
    expect(fake.queue).toHaveLength(0)
  })

  it('redelivers a notification until it is deleted', async () => {
    fake = createFakeGreenApi()
    const client = createGreenApiClient(creds, fake.fetch)
    fake.pushIncoming(FAKE_CHAT_ID, 'раз')
    const first = await client.receiveNotification(5)
    const again = await client.receiveNotification(5)
    expect(again?.receiptId).toBe(first?.receiptId)
    await expect(client.deleteNotification(first!.receiptId)).resolves.toBe(true)
    await expect(client.deleteNotification(first!.receiptId)).resolves.toBe(false)
  })

  it('returns null from an empty queue after waiting', async () => {
    fake = createFakeGreenApi({ maxReceiveWaitMs: 10 })
    const client = createGreenApiClient(creds, fake.fetch)
    await expect(client.receiveNotification(5)).resolves.toBeNull()
  })

  it('aborts a waiting receive', async () => {
    fake = createFakeGreenApi({ maxReceiveWaitMs: 60_000 })
    const client = createGreenApiClient(creds, fake.fetch)
    const controller = new AbortController()
    const pending = client.receiveNotification(20, controller.signal)
    controller.abort()
    const error = await pending.catch((e: unknown) => e)
    expect(error).toBeInstanceOf(GreenApiError)
    expect((error as GreenApiError).kind).toBe('aborted')
  })

  it('can inject failures', async () => {
    fake = createFakeGreenApi()
    const client = createGreenApiClient(creds, fake.fetch)
    fake.failNext('sendMessage', 466, '{"invokeStatus":{}}')
    await expect(client.sendMessage(FAKE_CHAT_ID, 'x')).rejects.toMatchObject({ kind: 'quota' })
    await expect(client.sendMessage(FAKE_CHAT_ID, 'x')).resolves.toHaveProperty('idMessage')
  })
})
