export type Credentials = {
  idInstance: string
  apiTokenInstance: string
  /** Without trailing slash, e.g. `https://4100.api.green-api.com`. */
  apiUrl: string
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** Documented values; kept open because GREEN-API may add new ones. */
export type StateInstance =
  | 'authorized'
  | 'notAuthorized'
  | 'blocked'
  | 'suspended'
  | 'starting'
  | 'pendingPassword'
  | (string & {})

export type InstanceSettings = {
  webhookUrl: string
  incomingWebhook: string
  outgoingWebhook: string
}

export type ReceivedNotification = {
  receiptId: number
  body: unknown
}

export type CheckAccountResult = {
  exist: boolean
  chatId: string
}

export interface GreenApiClient {
  getStateInstance(signal?: AbortSignal): Promise<StateInstance>
  getSettings(signal?: AbortSignal): Promise<InstanceSettings>
  /** Clears webhookUrl and enables incoming + outgoing-status notifications. Restarts the instance. */
  enableHttpNotifications(signal?: AbortSignal): Promise<void>
  checkAccount(phoneDigits: string, signal?: AbortSignal): Promise<CheckAccountResult>
  sendMessage(chatId: string, message: string, signal?: AbortSignal): Promise<{ idMessage: string }>
  /** Resolves to `null` when the queue stayed empty for `timeoutSec`. */
  receiveNotification(
    timeoutSec: number,
    signal?: AbortSignal,
  ): Promise<ReceivedNotification | null>
  deleteNotification(receiptId: number, signal?: AbortSignal): Promise<boolean>
}
