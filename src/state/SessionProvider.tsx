import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { createGreenApiClient } from '../api/greenApi'
import type { Credentials, FetchLike } from '../api/types'
import { clearChats, clearSession, loadSession, saveSession } from '../services/storage'
import {
  LoginError,
  loginErrorMessage,
  SessionContext,
  stateInstanceMessage,
  type LogoutOptions,
  type SessionValue,
} from './session'

type Props = {
  children: ReactNode
  /** Injected in tests and demo mode; defaults to the browser fetch. */
  fetchImpl?: FetchLike
}

export function SessionProvider({ children, fetchImpl }: Props) {
  const [credentials, setCredentials] = useState<Credentials | null>(loadSession)
  const [logoutReason, setLogoutReason] = useState<string | null>(null)

  const client = useMemo(
    () => (credentials ? createGreenApiClient(credentials, fetchImpl) : null),
    [credentials, fetchImpl],
  )

  const login = useCallback(
    async (next: Credentials) => {
      let state
      try {
        state = await createGreenApiClient(next, fetchImpl).getStateInstance()
      } catch (err) {
        throw new LoginError(loginErrorMessage(err))
      }
      if (state !== 'authorized') throw new LoginError(stateInstanceMessage(state))
      saveSession(next)
      setLogoutReason(null)
      setCredentials(next)
    },
    [fetchImpl],
  )

  const logout = useCallback(
    ({ reason, keepHistory = false }: LogoutOptions = {}) => {
      if (credentials && !keepHistory) clearChats(credentials.idInstance)
      clearSession()
      setLogoutReason(reason ?? null)
      setCredentials(null)
    },
    [credentials],
  )

  const value = useMemo<SessionValue>(
    () => ({ credentials, client, login, logout, logoutReason }),
    [credentials, client, login, logout, logoutReason],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}
