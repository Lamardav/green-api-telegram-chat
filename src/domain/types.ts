import type { DeliveryStatus } from '../api/notifications'

export type MessageStatus = 'pending' | DeliveryStatus

export type Message = {
  /** Stable client-side key; for incoming messages derived from idMessage. */
  localId: string
  idMessage?: string
  direction: 'in' | 'out'
  text: string
  /** Milliseconds since epoch. */
  timestamp: number
  /** Outgoing messages only. */
  status?: MessageStatus
  /** Human-readable reason when status is `failed`. */
  error?: string
}

export type Chat = {
  chatId: string
  title: string
  phone?: string
  messages: Message[]
  unread: number
  lastActivity: number
}

export type PendingStatus = { status: DeliveryStatus; description?: string }

export type ChatsState = {
  chats: Record<string, Chat>
  /** Chat ids, most recent activity first. */
  order: string[]
  activeChatId: string | null
  /** Statuses that arrived before the SendMessage response told us their idMessage. Not persisted. */
  pendingStatuses: Record<string, PendingStatus>
}
