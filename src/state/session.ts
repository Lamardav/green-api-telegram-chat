import { createContext, useContext } from 'react'
import { describeError } from '../api/errors'
import type { Credentials, GreenApiClient, StateInstance } from '../api/types'

export type LogoutOptions = {
  /** Shown on the login screen. */
  reason?: string
  /** Forced logouts keep history so it comes back after signing in again. */
  keepHistory?: boolean
}

export type SessionValue = {
  credentials: Credentials | null
  client: GreenApiClient | null
  login(credentials: Credentials): Promise<void>
  logout(options?: LogoutOptions): void
  logoutReason: string | null
}

export const SessionContext = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside <SessionProvider>')
  return value
}

export class LoginError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LoginError'
  }
}

const STATE_MESSAGES: Record<string, string> = {
  notAuthorized: 'Инстанс не авторизован. Подключите аккаунт Telegram в личном кабинете GREEN-API',
  starting: 'Инстанс запускается, попробуйте через минуту',
  blocked: 'Аккаунт Telegram заблокирован',
  suspended: 'Инстанс приостановлен — проверьте оплату в личном кабинете GREEN-API',
  pendingPassword:
    'Требуется пароль двухэтапной проверки — завершите авторизацию в личном кабинете GREEN-API',
}

export function stateInstanceMessage(state: StateInstance): string {
  return STATE_MESSAGES[state] ?? `Инстанс недоступен (состояние: ${state})`
}

export function loginErrorMessage(err: unknown): string {
  return err instanceof LoginError ? err.message : describeError(err)
}
