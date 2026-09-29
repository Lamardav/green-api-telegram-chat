import { describe, expect, it } from 'vitest'
import { parseNotification } from './notifications'

// Shapes follow https://green-api.com/telegram/docs/api/receiving/notifications-format/
const incomingText = {
  typeWebhook: 'incomingMessageReceived',
  instanceData: { idInstance: 4100000000, wid: '79876543210@c.us', typeInstance: 'telegram' },
  timestamp: 1763115112,
  idMessage: '1763115112345',
  senderData: {
    chatId: '10000000',
    chatType: 'user',
    sender: '10000000',
    chatName: 'Василиса Премудрая',
    senderName: 'Василиса Премудрая',
    senderType: 'user',
    senderContactName: 'Василиса Премудрая',
    senderPhoneNumber: 79998887766,
  },
  messageData: {
    typeMessage: 'textMessage',
    textMessageData: { textMessage: 'Привет!', forwardingScore: 0, isForwarded: false },
  },
}

const withMessageData = (messageData: unknown) => ({ ...incomingText, messageData })
const withSender = (patch: Record<string, unknown>) => ({
  ...incomingText,
  senderData: { ...incomingText.senderData, ...patch },
})

describe('incoming text messages', () => {
  it('parses textMessage', () => {
    expect(parseNotification(incomingText)).toEqual({
      type: 'incomingText',
      chatId: '10000000',
      idMessage: '1763115112345',
      text: 'Привет!',
      timestamp: 1763115112000,
      senderName: 'Василиса Премудрая',
    })
  })

  it('parses extendedTextMessage', () => {
    const event = parseNotification(
      withMessageData({
        typeMessage: 'extendedTextMessage',
        extendedTextMessageData: { text: 'https://example.com', description: '', title: '' },
      }),
    )
    expect(event).toMatchObject({ type: 'incomingText', text: 'https://example.com' })
  })

  it('accepts notifications without chatType (older payloads)', () => {
    const { chatType: _omit, ...senderData } = incomingText.senderData
    expect(parseNotification({ ...incomingText, senderData }).type).toBe('incomingText')
  })

  it('falls back through name fields to chatId', () => {
    const event = parseNotification(
      withSender({ senderName: '', chatName: '', senderContactName: '' }),
    )
    expect(event).toMatchObject({ senderName: '10000000' })
  })

  it.each([
    ['group chatType', withSender({ chatType: 'group' })],
    ['negative chatId', withSender({ chatId: '-10000000000000', chatType: undefined })],
    ['image message', withMessageData({ typeMessage: 'imageMessage' })],
    [
      'blank text',
      withMessageData({ typeMessage: 'textMessage', textMessageData: { textMessage: '  ' } }),
    ],
    ['missing idMessage', { ...incomingText, idMessage: undefined }],
  ])('ignores %s', (_name, body) => {
    expect(parseNotification(body).type).toBe('ignored')
  })
})

describe('outgoing message status', () => {
  const status = (value: string, extra: Record<string, unknown> = {}) => ({
    typeWebhook: 'outgoingMessageStatus',
    chatId: '10000000',
    instanceData: { idInstance: 4100000000, wid: '79876543210@c.us', typeInstance: 'telegram' },
    timestamp: 1755591519,
    idMessage: '115054445839974415',
    status: value,
    ...extra,
  })

  it.each(['sent', 'delivered', 'read'])('passes through %s', (value) => {
    expect(parseNotification(status(value))).toEqual({
      type: 'outgoingStatus',
      chatId: '10000000',
      idMessage: '115054445839974415',
      status: value,
    })
  })

  it('maps noAccount to failed with an explanation', () => {
    expect(parseNotification(status('noAccount'))).toMatchObject({
      status: 'failed',
      description: 'У получателя нет аккаунта Telegram или номер скрыт настройками приватности',
    })
  })

  it('keeps the failure description', () => {
    expect(parseNotification(status('failed', { description: 'boom' }))).toMatchObject({
      status: 'failed',
      description: 'boom',
    })
  })

  it('ignores unknown statuses', () => {
    expect(parseNotification(status('pending')).type).toBe('ignored')
  })
})

describe('everything else', () => {
  it.each([
    ['outgoing from phone', { ...incomingText, typeWebhook: 'outgoingMessageReceived' }],
    ['outgoing from API', { ...incomingText, typeWebhook: 'outgoingAPIMessageReceived' }],
    ['state change', { typeWebhook: 'stateInstanceChanged', stateInstance: 'authorized' }],
    ['quota', { typeWebhook: 'quotaExceeded' }],
    ['null', null],
    ['string', 'hello'],
    ['empty object', {}],
  ])('ignores %s without throwing', (_name, body) => {
    expect(parseNotification(body).type).toBe('ignored')
  })
})
