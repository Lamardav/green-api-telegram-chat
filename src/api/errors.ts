export type GreenApiErrorKind =
  | 'unauthorized'
  | 'notAuthorized'
  | 'webhookSet'
  | 'badRequest'
  | 'quota'
  | 'rateLimit'
  | 'server'
  | 'network'
  | 'badResponse'
  | 'aborted'

export class GreenApiError extends Error {
  readonly kind: GreenApiErrorKind
  readonly status: number | undefined

  constructor(kind: GreenApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'GreenApiError'
    this.kind = kind
    this.status = status
  }
}

export function isGreenApiError(err: unknown, kind?: GreenApiErrorKind): err is GreenApiError {
  return err instanceof GreenApiError && (kind === undefined || err.kind === kind)
}

export function classifyHttpError(status: number, bodyText: string): GreenApiError {
  if (status === 401 || status === 403) return new GreenApiError('unauthorized', bodyText, status)
  if (status === 466) return new GreenApiError('quota', bodyText, status)
  if (status === 429) return new GreenApiError('rateLimit', bodyText, status)
  if (status >= 500) return new GreenApiError('server', bodyText, status)
  return new GreenApiError(reasonKind(bodyText), bodyText, status)
}

/** For errors GREEN-API reports in a 200 body, e.g. `{ "status": false, "reason": "..." }`. */
export function classifyReason(reason: string): GreenApiError {
  return new GreenApiError(reasonKind(reason), reason)
}

function reasonKind(text: string): GreenApiErrorKind {
  const reason = text.toLowerCase()
  if (reason.includes('webhook url')) return 'webhookSet'
  if (reason.includes('not authorized') || reason.includes('starting')) return 'notAuthorized'
  return 'badRequest'
}

const MESSAGES: Record<GreenApiErrorKind, string> = {
  unauthorized: 'Неверный idInstance или apiTokenInstance',
  notAuthorized:
    'Инстанс не авторизован или запускается. Проверьте его в личном кабинете GREEN-API',
  webhookSet: 'Получение сообщений выключено: в настройках инстанса задан webhookUrl',
  badRequest: 'GREEN-API отклонил запрос',
  quota: 'Достигнут лимит тарифа Developer (3 чата / 100 проверок номера в месяц)',
  rateLimit: 'Слишком много запросов, повторите позже',
  server: 'Сервис GREEN-API временно недоступен, повторите позже',
  network: 'Не удалось связаться с GREEN-API. Проверьте apiUrl и подключение к сети',
  badResponse: 'Неожиданный ответ GREEN-API',
  aborted: 'Запрос отменён',
}

/** User-facing Russian description of any error thrown by the API layer. */
export function describeError(err: unknown): string {
  if (err instanceof GreenApiError) return MESSAGES[err.kind]
  return 'Что-то пошло не так, попробуйте ещё раз'
}
