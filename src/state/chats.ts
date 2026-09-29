import { createContext, useContext } from 'react'
import type { ChatsState } from '../domain/types'
import type { PollerStatus } from '../services/poller'

export type SettingsStatus = 'checking' | 'ready' | 'needsSetup' | 'applying' | 'applied' | 'error'

export type OpenChatResult = { ok: true } | { ok: false; error: string }

export type ChatsValue = {
  state: ChatsState
  settings: SettingsStatus
  /** Webhook currently configured on the instance (it blocks HTTP API receiving). */
  webhookUrl: string
  settingsError: string | null
  connection: PollerStatus
  openChatByPhone(raw: string): Promise<OpenChatResult>
  selectChat(chatId: string | null): void
  sendText(chatId: string, text: string): Promise<void>
  retry(chatId: string, localId: string): Promise<void>
  enableNotifications(): Promise<void>
  recheckSettings(): void
  dismissSettingsNotice(): void
}

export const MAX_MESSAGE_LENGTH = 4096

export const ChatsContext = createContext<ChatsValue | null>(null)

export function useChats(): ChatsValue {
  const value = useContext(ChatsContext)
  if (!value) throw new Error('useChats must be used inside <ChatsProvider>')
  return value
}
