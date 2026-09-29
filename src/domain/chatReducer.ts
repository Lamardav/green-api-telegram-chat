import type { DeliveryStatus, IncomingTextEvent, OutgoingStatusEvent } from '../api/notifications'
import type { Chat, ChatsState, Message, MessageStatus, PendingStatus } from './types'

export type ChatAction =
  | { type: 'chatOpened'; chatId: string; title: string; phone?: string; now: number }
  | { type: 'chatSelected'; chatId: string | null }
  | { type: 'messageQueued'; chatId: string; localId: string; text: string; now: number }
  | { type: 'messageSent'; chatId: string; localId: string; idMessage: string }
  | { type: 'messageFailed'; chatId: string; localId: string; error: string }
  | { type: 'messageRetry'; chatId: string; localId: string }
  | { type: 'incomingText'; event: IncomingTextEvent }
  | { type: 'outgoingStatus'; event: OutgoingStatusEvent }
  | { type: 'replaced'; state: ChatsState }

export const initialChatsState: ChatsState = {
  chats: {},
  order: [],
  activeChatId: null,
  pendingStatuses: {},
}

const DEFAULT_FAILURE = 'Сообщение не доставлено'

const RANK: Record<MessageStatus, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: -1,
}

export function chatReducer(state: ChatsState, action: ChatAction): ChatsState {
  switch (action.type) {
    case 'chatOpened': {
      const existing = state.chats[action.chatId]
      const chat: Chat = existing
        ? {
            ...existing,
            unread: 0,
            title: existing.title === existing.chatId ? action.title : existing.title,
            ...(existing.phone === undefined && action.phone !== undefined
              ? { phone: action.phone }
              : {}),
          }
        : {
            chatId: action.chatId,
            title: action.title,
            ...(action.phone !== undefined ? { phone: action.phone } : {}),
            messages: [],
            unread: 0,
            lastActivity: action.now,
          }
      return withChat({ ...state, activeChatId: action.chatId }, chat)
    }

    case 'chatSelected': {
      const chat = action.chatId === null ? undefined : state.chats[action.chatId]
      const next = { ...state, activeChatId: action.chatId }
      return chat && chat.unread > 0 ? withChat(next, { ...chat, unread: 0 }) : next
    }

    case 'messageQueued': {
      const chat = state.chats[action.chatId]
      if (!chat) return state
      const message: Message = {
        localId: action.localId,
        direction: 'out',
        text: action.text,
        timestamp: action.now,
        status: 'pending',
      }
      return withChat(state, {
        ...chat,
        messages: insertByTime(chat.messages, message),
        lastActivity: Math.max(chat.lastActivity, action.now),
      })
    }

    case 'messageSent': {
      const buffered = state.pendingStatuses[action.idMessage]
      const next = updateMessage(state, action.chatId, action.localId, (m) => {
        const sent: Message = { ...m, idMessage: action.idMessage, status: 'sent' }
        return buffered ? applyStatus(sent, buffered) : sent
      })
      if (next === state || !buffered) return next
      const { [action.idMessage]: _applied, ...rest } = next.pendingStatuses
      return { ...next, pendingStatuses: rest }
    }

    case 'messageFailed':
      return updateMessage(state, action.chatId, action.localId, (m) =>
        m.status === 'pending' ? { ...m, status: 'failed', error: action.error } : m,
      )

    case 'messageRetry':
      return updateMessage(state, action.chatId, action.localId, (m) => {
        if (m.status !== 'failed') return m
        const { error: _error, idMessage: _id, ...rest } = m
        return { ...rest, status: 'pending' }
      })

    case 'incomingText':
      return receiveIncoming(state, action.event)

    case 'outgoingStatus':
      return receiveStatus(state, action.event)

    case 'replaced': {
      const { chats, order } = action.state
      const activeChatId =
        state.activeChatId !== null && chats[state.activeChatId] ? state.activeChatId : null
      return { chats, order, activeChatId, pendingStatuses: state.pendingStatuses }
    }
  }
}

function receiveIncoming(state: ChatsState, event: IncomingTextEvent): ChatsState {
  const existing = state.chats[event.chatId]
  if (existing?.messages.some((m) => m.idMessage === event.idMessage)) return state

  const chat: Chat = existing ?? {
    chatId: event.chatId,
    title: event.senderName,
    messages: [],
    unread: 0,
    lastActivity: event.timestamp,
  }
  const message: Message = {
    localId: `in:${event.idMessage}`,
    idMessage: event.idMessage,
    direction: 'in',
    text: event.text,
    timestamp: event.timestamp,
  }
  return withChat(state, {
    ...chat,
    messages: insertByTime(chat.messages, message),
    unread: state.activeChatId === event.chatId ? chat.unread : chat.unread + 1,
    lastActivity: Math.max(chat.lastActivity, event.timestamp),
  })
}

function receiveStatus(state: ChatsState, event: OutgoingStatusEvent): ChatsState {
  const update: PendingStatus = { status: event.status }
  if (event.description !== undefined) update.description = event.description

  const located = findByIdMessage(state, event.chatId, event.idMessage)
  if (located) {
    return updateMessage(state, located.chatId, located.localId, (m) => applyStatus(m, update))
  }

  // SendMessage has not resolved yet: remember the best status we have seen.
  const previous = state.pendingStatuses[event.idMessage]
  if (previous && !isUpgrade(previous.status, update.status)) return state
  return { ...state, pendingStatuses: { ...state.pendingStatuses, [event.idMessage]: update } }
}

function isUpgrade(current: MessageStatus, next: DeliveryStatus): boolean {
  if (next === 'failed') return current === 'pending' || current === 'sent'
  if (current === 'failed') return false
  return RANK[next] > RANK[current]
}

function applyStatus(message: Message, update: PendingStatus): Message {
  const current = message.status ?? 'pending'
  if (!isUpgrade(current, update.status)) return message
  if (update.status === 'failed') {
    return { ...message, status: 'failed', error: update.description ?? DEFAULT_FAILURE }
  }
  return { ...message, status: update.status }
}

function findByIdMessage(state: ChatsState, chatId: string, idMessage: string) {
  const candidates = state.chats[chatId] ? [state.chats[chatId]] : Object.values(state.chats)
  for (const chat of candidates) {
    const message = chat.messages.find((m) => m.idMessage === idMessage)
    if (message) return { chatId: chat.chatId, localId: message.localId }
  }
  return null
}

function updateMessage(
  state: ChatsState,
  chatId: string,
  localId: string,
  change: (m: Message) => Message,
): ChatsState {
  const chat = state.chats[chatId]
  if (!chat) return state
  const index = chat.messages.findIndex((m) => m.localId === localId)
  if (index === -1) return state
  const before = chat.messages[index]!
  const after = change(before)
  if (after === before) return state
  const messages = chat.messages.slice()
  messages[index] = after
  return withChat(state, { ...chat, messages })
}

function insertByTime(messages: Message[], message: Message): Message[] {
  let index = messages.length
  while (index > 0 && messages[index - 1]!.timestamp > message.timestamp) index--
  return [...messages.slice(0, index), message, ...messages.slice(index)]
}

function withChat(state: ChatsState, chat: Chat): ChatsState {
  const chats = { ...state.chats, [chat.chatId]: chat }
  const order = Object.values(chats)
    .sort((a, b) => b.lastActivity - a.lastActivity)
    .map((c) => c.chatId)
  return { ...state, chats, order }
}
