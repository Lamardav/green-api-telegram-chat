import type { Credentials } from '../api/types'
import type { Chat, ChatsState, Message, MessageStatus } from '../domain/types'
import { isNumber, isObject, isString } from '../lib/guards'

export type Theme = 'simple' | 'space'

const SESSION_KEY = 'gac:session'
const THEME_KEY = 'gac:theme'

export const chatsKey = (idInstance: string) => `gac:v1:chats:${idInstance}`

/** Keeps the saved history (and every write) bounded: localStorage has a ~5 MB quota. */
export const MAX_STORED_MESSAGES_PER_CHAT = 500

export const INTERRUPTED_SEND =
  'Отправка прервана: страница была закрыта или перезагружена. Проверьте, дошло ли сообщение, прежде чем повторять'

// Storage access itself can throw (disabled cookies, private mode, quota), so every call is guarded
// and the app degrades to in-memory state instead of crashing.
type Area = 'session' | 'local'
const area = (a: Area): Storage => (a === 'session' ? sessionStorage : localStorage)

function read(a: Area, key: string): string | null {
  try {
    return area(a).getItem(key)
  } catch {
    return null
  }
}

function write(a: Area, key: string, value: string): boolean {
  try {
    area(a).setItem(key, value)
    return true
  } catch {
    return false
  }
}

function remove(a: Area, key: string): void {
  try {
    area(a).removeItem(key)
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

function readJson(a: Area, key: string): unknown {
  const raw = read(a, key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export function loadSession(): Credentials | null {
  const data = readJson('session', SESSION_KEY)
  if (!isObject(data)) return null
  const { idInstance, apiTokenInstance, apiUrl } = data
  if (!isString(idInstance) || !isString(apiTokenInstance) || !isString(apiUrl)) return null
  return { idInstance, apiTokenInstance, apiUrl }
}

export function saveSession(creds: Credentials): void {
  write('session', SESSION_KEY, JSON.stringify(creds))
}

export function clearSession(): void {
  remove('session', SESSION_KEY)
}

const STATUSES = new Set<unknown>(['pending', 'sent', 'delivered', 'read', 'failed'])
const isStatus = (v: unknown): v is MessageStatus => STATUSES.has(v)

function toMessage(v: unknown): Message | null {
  if (!isObject(v)) return null
  const { localId, idMessage, direction, text, timestamp, status, error } = v
  if (!isString(localId) || !isString(text) || !isNumber(timestamp)) return null
  if (direction !== 'in' && direction !== 'out') return null
  const message: Message = { localId, direction, text, timestamp }
  if (isString(idMessage)) message.idMessage = idMessage
  if (direction === 'out') {
    // No request survives a page unload, so anything still "sending" has an unknown fate.
    if (!isStatus(status) || status === 'pending') {
      message.status = 'failed'
      message.error = INTERRUPTED_SEND
    } else {
      message.status = status
      if (status === 'failed') message.error = isString(error) ? error : INTERRUPTED_SEND
    }
  }
  return message
}

function toChat(v: unknown): Chat | null {
  if (!isObject(v)) return null
  const { chatId, title, phone, messages, unread, lastActivity } = v
  if (!isString(chatId) || !isString(title) || !Array.isArray(messages)) return null
  const chat: Chat = {
    chatId,
    title,
    messages: messages.map(toMessage).filter((m): m is Message => m !== null),
    unread: isNumber(unread) ? unread : 0,
    lastActivity: isNumber(lastActivity) ? lastActivity : 0,
  }
  if (isString(phone)) chat.phone = phone
  return chat
}

export function loadChats(idInstance: string): ChatsState | null {
  const data = readJson('local', chatsKey(idInstance))
  if (!isObject(data) || !isObject(data.chats) || !Array.isArray(data.order)) return null

  const chats: Record<string, Chat> = {}
  for (const value of Object.values(data.chats)) {
    const chat = toChat(value)
    if (chat) chats[chat.chatId] = chat
  }
  const order = data.order.filter((id): id is string => isString(id) && id in chats)
  for (const id of Object.keys(chats)) if (!order.includes(id)) order.push(id)
  const active = data.activeChatId
  return {
    chats,
    order,
    activeChatId: isString(active) && active in chats ? active : null,
    pendingStatuses: [],
  }
}

/** Returns false when the browser refused the write (quota exceeded or storage disabled). */
export function saveChats(idInstance: string, state: ChatsState): boolean {
  const chats: Record<string, Chat> = {}
  for (const [id, chat] of Object.entries(state.chats)) {
    chats[id] =
      chat.messages.length > MAX_STORED_MESSAGES_PER_CHAT
        ? { ...chat, messages: chat.messages.slice(-MAX_STORED_MESSAGES_PER_CHAT) }
        : chat
  }
  const { order, activeChatId } = state
  return write('local', chatsKey(idInstance), JSON.stringify({ chats, order, activeChatId }))
}

export function clearChats(idInstance: string): void {
  remove('local', chatsKey(idInstance))
}

export function loadTheme(): Theme {
  return read('local', THEME_KEY) === 'space' ? 'space' : 'simple'
}

export function saveTheme(theme: Theme): void {
  write('local', THEME_KEY, theme)
}
