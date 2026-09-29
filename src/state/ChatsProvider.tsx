import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { describeError, GreenApiError, isGreenApiError } from '../api/errors'
import { settingsReady } from '../api/greenApi'
import type { Credentials, GreenApiClient } from '../api/types'
import { chatReducer, initialChatsState, type ChatAction } from '../domain/chatReducer'
import { formatPhone, normalizePhone } from '../domain/phone'
import { runPoller, type PollerStatus } from '../services/poller'
import { chatsKey, loadChats, parseChatsJson, saveChats } from '../services/storage'
import { runExclusive } from '../services/tabLock'
import {
  ChatsContext,
  MAX_MESSAGE_LENGTH,
  type ChatsValue,
  type OpenChatResult,
  type SettingsStatus,
} from './chats'
import { useSession } from './session'

const SESSION_EXPIRED = 'Сессия недействительна, войдите снова'
const NOT_FOUND = 'У этого номера нет Telegram или он скрыт настройками приватности'

const makeLocalId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

type Props = { children: ReactNode }

/** Requires a signed-in session; render it keyed by idInstance. */
export function ChatsProvider({ children }: Props) {
  const { credentials, client, logout } = useSession()
  if (!credentials || !client) throw new Error('ChatsProvider requires an active session')
  return (
    <ChatsProviderInner credentials={credentials} client={client} logout={logout}>
      {children}
    </ChatsProviderInner>
  )
}

type InnerProps = Props & {
  credentials: Credentials
  client: GreenApiClient
  logout: ReturnType<typeof useSession>['logout']
}

function ChatsProviderInner({ children, credentials, client, logout }: InnerProps) {
  const id = credentials.idInstance
  const [state, dispatch] = useReducer(
    chatReducer,
    id,
    (key) => loadChats(key) ?? initialChatsState,
  )
  const [settings, setSettings] = useState<SettingsStatus>('checking')
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [polling, setPolling] = useState(false)
  const [connection, setConnection] = useState<PollerStatus>('ok')
  const [settingsCheck, setSettingsCheck] = useState(0)

  // Latest state for async callbacks, without re-creating them on every change.
  const stateRef = useRef(state)
  useLayoutEffect(() => {
    stateRef.current = state
  })
  const skipNextSave = useRef(false)

  const expireSession = useCallback(
    () => logout({ reason: SESSION_EXPIRED, keepHistory: true }),
    [logout],
  )

  // Persist every change; skip the write that merely mirrors another tab to avoid ping-pong.
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    saveChats(id, state)
  }, [id, state])

  // Mirror changes made in other tabs of the same instance.
  useEffect(() => {
    const key = chatsKey(id)
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return
      const next = parseChatsJson(event.newValue)
      if (!next) return
      skipNextSave.current = true
      dispatch({ type: 'replaced', state: next })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [id])

  // Receiving via HTTP API requires specific instance settings; check them first.
  useEffect(() => {
    const controller = new AbortController()
    client
      .getSettings(controller.signal)
      .then((s) => {
        setWebhookUrl(s.webhookUrl)
        setSettingsError(null)
        if (settingsReady(s)) {
          setSettings('ready')
          setPolling(true)
        } else {
          setSettings('needsSetup')
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isGreenApiError(err, 'aborted')) return
        if (isGreenApiError(err, 'unauthorized')) return expireSession()
        setSettings('error')
        setSettingsError(describeError(err))
        // Still try to receive: the poller backs off and reports fatal misconfiguration itself.
        setPolling(true)
      })
    return () => controller.abort()
  }, [client, expireSession, settingsCheck])

  useEffect(() => {
    if (!polling) return
    const controller = new AbortController()
    const onFatal = (err: GreenApiError) => {
      if (err.kind === 'unauthorized') return expireSession()
      setPolling(false)
      setSettings('needsSetup')
    }
    runExclusive(
      `gac-poller-${id}`,
      (signal) =>
        runPoller({
          client,
          signal,
          onFatal,
          onStatus: setConnection,
          onEvent: (event) => {
            if (event.type === 'incomingText') dispatch({ type: 'incomingText', event })
            else if (event.type === 'outgoingStatus') dispatch({ type: 'outgoingStatus', event })
          },
        }),
      controller.signal,
    ).catch((err: unknown) => console.error('Notification polling stopped', err))
    return () => controller.abort()
  }, [client, expireSession, id, polling])

  const deliver = useCallback(
    async (chatId: string, localId: string, text: string) => {
      try {
        const { idMessage } = await client.sendMessage(chatId, text)
        dispatch({ type: 'messageSent', chatId, localId, idMessage })
      } catch (err) {
        if (isGreenApiError(err, 'unauthorized')) expireSession()
        dispatch({ type: 'messageFailed', chatId, localId, error: describeError(err) })
      }
    },
    [client, expireSession],
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
    [deliver],
  )

  const retry = useCallback(
    async (chatId: string, localId: string) => {
      const message = stateRef.current.chats[chatId]?.messages.find((m) => m.localId === localId)
      if (!message || message.status !== 'failed') return
      dispatch({ type: 'messageRetry', chatId, localId })
      await deliver(chatId, localId, message.text)
    },
    [deliver],
  )

  const openChatByPhone = useCallback(
    async (raw: string): Promise<OpenChatResult> => {
      const phone = normalizePhone(raw)
      if (!phone.ok) return phone
      const open = (chatId: string): OpenChatResult => {
        const action: ChatAction = {
          type: 'chatOpened',
          chatId,
          title: formatPhone(phone.digits),
          phone: phone.digits,
          now: Date.now(),
        }
        dispatch(action)
        return { ok: true }
      }
      // Reuse a known chat without spending CheckAccount quota.
      const known = Object.values(stateRef.current.chats).find((c) => c.phone === phone.digits)
      if (known) return open(known.chatId)
      try {
        const account = await client.checkAccount(phone.digits)
        if (!account.exist || account.chatId === '') return { ok: false, error: NOT_FOUND }
        return open(account.chatId)
      } catch (err) {
        if (isGreenApiError(err, 'unauthorized')) expireSession()
        return { ok: false, error: describeError(err) }
      }
    },
    [client, expireSession],
  )

  const selectChat = useCallback((chatId: string | null) => {
    dispatch({ type: 'chatSelected', chatId })
  }, [])

  const enableNotifications = useCallback(async () => {
    setSettings('applying')
    setSettingsError(null)
    try {
      await client.enableHttpNotifications()
      setWebhookUrl('')
      setSettings('applied')
      setPolling(true)
    } catch (err) {
      if (isGreenApiError(err, 'unauthorized')) return expireSession()
      setSettings('needsSetup')
      setSettingsError(describeError(err))
    }
  }, [client, expireSession])

  const recheckSettings = useCallback(() => {
    setSettings('checking')
    setSettingsCheck((n) => n + 1)
  }, [])
  const dismissSettingsNotice = useCallback(() => setSettings('ready'), [])

  const value = useMemo<ChatsValue>(
    () => ({
      state,
      settings,
      webhookUrl,
      settingsError,
      connection,
      openChatByPhone,
      selectChat,
      sendText,
      retry,
      enableNotifications,
      recheckSettings,
      dismissSettingsNotice,
    }),
    [
      state,
      settings,
      webhookUrl,
      settingsError,
      connection,
      openChatByPhone,
      selectChat,
      sendText,
      retry,
      enableNotifications,
      recheckSettings,
      dismissSettingsNotice,
    ],
  )

  return <ChatsContext value={value}>{children}</ChatsContext>
}
