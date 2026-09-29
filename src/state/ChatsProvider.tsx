import { useCallback, useMemo, type ReactNode } from 'react'
import { isGreenApiError, type GreenApiError } from '../api/errors'
import type { Credentials, GreenApiClient } from '../api/types'
import { isFatalByDefault } from '../services/poller'
import { ChatsContext, type ChatsValue } from './chats'
import { useSession, type SessionValue } from './session'
import { useChatActions } from './useChatActions'
import { useInstanceSettings } from './useInstanceSettings'
import { useNotificationPoller } from './useNotificationPoller'
import { usePersistedChats } from './usePersistedChats'

const SESSION_EXPIRED = 'Сессия недействительна, войдите снова'

type Props = { children: ReactNode }

/** Chat state and actions for the signed-in instance. Render it keyed by idInstance. */
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
  logout: SessionValue['logout']
}

function ChatsProviderInner({ children, credentials, client, logout }: InnerProps) {
  const { state, dispatch, storageOk } = usePersistedChats(credentials.idInstance)

  const expireSession = useCallback(
    () => logout({ reason: SESSION_EXPIRED, keepHistory: true }),
    [logout],
  )

  const settings = useInstanceSettings(client, expireSession)
  const actions = useChatActions(client, state, dispatch, expireSession)

  const connection = useNotificationPoller({
    client,
    enabled: settings.receiving,
    onEvent: (event) => {
      if (event.type === 'incomingText') dispatch({ type: 'incomingText', event })
      else if (event.type === 'outgoingStatus') dispatch({ type: 'outgoingStatus', event })
    },
    // Right after enabling notifications the instance may still report the old webhook.
    isFatal: (error): error is GreenApiError =>
      isFatalByDefault(error) && !(isGreenApiError(error, 'webhookSet') && settings.isApplying()),
    onFatal: (error) => {
      if (error.kind === 'unauthorized') expireSession()
      else settings.reportBlocked()
    },
  })

  const value = useMemo<ChatsValue>(
    () => ({
      state,
      storageOk,
      connection,
      settings: settings.status,
      webhookUrl: settings.webhookUrl,
      settingsError: settings.error,
      enableNotifications: settings.enable,
      recheckSettings: settings.recheck,
      dismissSettingsNotice: settings.dismiss,
      ...actions,
    }),
    [
      state,
      storageOk,
      connection,
      settings.status,
      settings.webhookUrl,
      settings.error,
      settings.enable,
      settings.recheck,
      settings.dismiss,
      actions,
    ],
  )

  return <ChatsContext value={value}>{children}</ChatsContext>
}
