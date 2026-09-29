export type IncomingTextEvent = {
  type: 'incomingText'
  chatId: string
  idMessage: string
  text: string
  /** Milliseconds since epoch (GREEN-API sends seconds). */
  timestamp: number
  senderName: string
}

export type DeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed'

export type OutgoingStatusEvent = {
  type: 'outgoingStatus'
  chatId: string
  idMessage: string
  status: DeliveryStatus
  description?: string
}

export type IgnoredEvent = { type: 'ignored'; reason: string }

export type DomainEvent = IncomingTextEvent | OutgoingStatusEvent | IgnoredEvent

type Obj = Record<string, unknown>

const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const ignored = (reason: string): IgnoredEvent => ({ type: 'ignored', reason })

const NO_ACCOUNT = 'У получателя нет аккаунта Telegram или номер скрыт настройками приватности'

/**
 * Converts a raw notification body into an app event.
 * Anything the app does not handle (media, groups, other webhook types, malformed data)
 * becomes `ignored` so the caller can still acknowledge it and keep the queue moving.
 */
export function parseNotification(body: unknown): DomainEvent {
  if (!isObject(body)) return ignored('not an object')
  switch (body.typeWebhook) {
    case 'incomingMessageReceived':
      return parseIncoming(body)
    case 'outgoingMessageStatus':
      return parseStatus(body)
    default:
      return ignored(`typeWebhook ${String(body.typeWebhook)}`)
  }
}

function parseIncoming(body: Obj): DomainEvent {
  const sender = body.senderData
  const data = body.messageData
  const idMessage = str(body.idMessage)
  if (!isObject(sender) || !isObject(data) || idMessage === '') return ignored('malformed')

  const chatId = str(sender.chatId)
  if (chatId === '' || chatId.startsWith('-')) return ignored('not a personal chat')
  if (sender.chatType !== undefined && sender.chatType !== 'user') {
    return ignored(`chatType ${String(sender.chatType)}`)
  }

  const text = extractText(data)
  if (text === null || text.trim() === '') return ignored('not a text message')

  const timestamp = typeof body.timestamp === 'number' ? body.timestamp * 1000 : Date.now()
  const senderName =
    str(sender.senderName) || str(sender.chatName) || str(sender.senderContactName) || chatId

  return { type: 'incomingText', chatId, idMessage, text, timestamp, senderName }
}

function extractText(data: Obj): string | null {
  if (data.typeMessage === 'textMessage' && isObject(data.textMessageData)) {
    return str(data.textMessageData.textMessage)
  }
  if (data.typeMessage === 'extendedTextMessage' && isObject(data.extendedTextMessageData)) {
    return str(data.extendedTextMessageData.text)
  }
  return null
}

function parseStatus(body: Obj): DomainEvent {
  const chatId = str(body.chatId)
  const idMessage = str(body.idMessage)
  if (idMessage === '') return ignored('malformed status')

  switch (body.status) {
    case 'sent':
    case 'delivered':
    case 'read':
      return { type: 'outgoingStatus', chatId, idMessage, status: body.status }
    case 'noAccount':
      return {
        type: 'outgoingStatus',
        chatId,
        idMessage,
        status: 'failed',
        description: NO_ACCOUNT,
      }
    case 'failed': {
      const event: OutgoingStatusEvent = {
        type: 'outgoingStatus',
        chatId,
        idMessage,
        status: 'failed',
      }
      const description = str(body.description)
      if (description !== '') event.description = description
      return event
    }
    default:
      return ignored(`status ${String(body.status)}`)
  }
}
