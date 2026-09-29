import { useCallback, useMemo, type Dispatch } from 'react'
import { describeError, isGreenApiError } from '../api/errors'
import type { GreenApiClient } from '../api/types'
import type { ChatAction } from '../domain/chatReducer'
import { formatPhone, normalizePhone } from '../domain/phone'
import type { ChatsState } from '../domain/types'
import { MAX_MESSAGE_LENGTH, type OpenChatResult } from './chats'
import { useLatest } from './useLatest'

const NOT_FOUND = 'У этого номера нет Telegram или он скрыт настройками приватности'

const makeLocalId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** User actions: open a chat by phone, send and retry messages. */
export function useChatActions(
  client: GreenApiClient,
  state: ChatsState,
  dispatch: Dispatch<ChatAction>,
  onUnauthorized: () => void,
) {
  const stateRef = useLatest(state)

  const deliver = useCallback(
    async (chatId: string, localId: string, text: string) => {
      try {
        const { idMessage } = await client.sendMessage(chatId, text)
        dispatch({ type: 'messageSent', chatId, localId, idMessage })
      } catch (err) {
        dispatch({ type: 'messageFailed', chatId, localId, error: describeError(err) })
        if (isGreenApiError(err, 'unauthorized')) onUnauthorized()
      }
    },
    [client, dispatch, onUnauthorized],
  )

  const sendText = useCallback(
    async (chatId: string, raw: string) => {
      const text = raw.trim()
      if (text === '' || text.length > MAX_MESSAGE_LENGTH) return
      if (!stateRef.current.chats[chatId]) return
      const localId = makeLocalId()
      dispatch({ type: 'messageQueued', chatId, localId, text, now: Date.now() })
      await deliver(chatId, localId, text)
    },
    [deliver, dispatch, stateRef],
  )

  const retry = useCallback(
    async (chatId: string, localId: string) => {
      const message = stateRef.current.chats[chatId]?.messages.find((m) => m.localId === localId)
      if (!message || message.status !== 'failed') return
      dispatch({ type: 'messageRetry', chatId, localId })
      await deliver(chatId, localId, message.text)
    },
    [deliver, dispatch, stateRef],
  )

  const openChatByPhone = useCallback(
    async (raw: string): Promise<OpenChatResult> => {
      const phone = normalizePhone(raw)
      if (!phone.ok) return phone
      const open = (chatId: string): OpenChatResult => {
        dispatch({
          type: 'chatOpened',
          chatId,
          title: formatPhone(phone.digits),
          phone: phone.digits,
          now: Date.now(),
        })
        return { ok: true }
      }
      // A known chat opens without spending CheckAccount quota.
      const known = Object.values(stateRef.current.chats).find((c) => c.phone === phone.digits)
      if (known) return open(known.chatId)
      try {
        const account = await client.checkAccount(phone.digits)
        if (!account.exist || account.chatId === '') return { ok: false, error: NOT_FOUND }
        return open(account.chatId)
      } catch (err) {
        if (isGreenApiError(err, 'unauthorized')) onUnauthorized()
        return { ok: false, error: describeError(err) }
      }
    },
    [client, dispatch, onUnauthorized, stateRef],
  )

  const selectChat = useCallback(
    (chatId: string | null) => dispatch({ type: 'chatSelected', chatId }),
    [dispatch],
  )

  return useMemo(
    () => ({ sendText, retry, openChatByPhone, selectChat }),
    [sendText, retry, openChatByPhone, selectChat],
  )
}
