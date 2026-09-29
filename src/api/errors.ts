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
  const body = bodyText.toLowerCase()
  if (status === 401 || status === 403) return new GreenApiError('unauthorized', bodyText, status)
  if (status === 466) return new GreenApiError('quota', bodyText, status)
  if (status === 429) return new GreenApiError('rateLimit', bodyText, status)
  if (status >= 500) return new GreenApiError('server', bodyText, status)
  if (status === 400 && body.includes('webhook url')) {
    return new GreenApiError('webhookSet', bodyText, status)
  }
  if (status === 400 && (body.includes('not authorized') || body.includes('starting'))) {
    return new GreenApiError('notAuthorized', bodyText, status)
  }
  return new GreenApiError('badRequest', bodyText, status)
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
