import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { deriveApiUrl, isValidIdInstance, normalizeApiUrl } from '../../domain/apiUrl'
import { loginErrorMessage, useSession } from '../../state/session'
import { AppMark } from '../icons'
import styles from './LoginScreen.module.css'

type Props = {
  /** Extra content under the form, e.g. demo credentials in mock mode. */
  hint?: ReactNode
}

export function LoginScreen({ hint }: Props) {
  const { login, logoutReason } = useSession()
  const ids = useId()
  const [idInstance, setIdInstance] = useState('')
  const [token, setToken] = useState('')
  const [customApiUrl, setCustomApiUrl] = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const id = idInstance.trim()
  const idValid = isValidIdInstance(id)
  const apiUrl = customApiUrl ?? (idValid ? deriveApiUrl(id) : '')
  const normalizedApiUrl = normalizeApiUrl(apiUrl)
  const canSubmit = idValid && token.trim() !== '' && normalizedApiUrl !== null && !pending

  const idError = id !== '' && !idValid ? 'idInstance состоит только из цифр' : null
  const urlError =
    customApiUrl !== null && normalizedApiUrl === null
      ? 'Укажите адрес вида https://1234.api.green-api.com'
      : null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit || normalizedApiUrl === null) return
    setPending(true)
    setError(null)
    try {
      await login({ idInstance: id, apiTokenInstance: token.trim(), apiUrl: normalizedApiUrl })
    } catch (err) {
      setError(loginErrorMessage(err))
      setPending(false)
    }
  }

  return (
    <main className={styles.screen}>
      <section className={styles.card} aria-labelledby={`${ids}-title`}>
        <AppMark className={styles.mark} />
        <h1 id={`${ids}-title`} className={styles.title}>
          Вход в чат
        </h1>
        <p className={styles.subtitle}>
          Введите данные инстанса из личного кабинета GREEN-API, чтобы переписываться в Telegram
        </p>

        {logoutReason && (
          <p className={styles.info} role="status">
            {logoutReason}
          </p>
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor={`${ids}-id`}>idInstance</label>
            <input
              id={`${ids}-id`}
              name="idInstance"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              placeholder="1101000001"
              value={idInstance}
              onChange={(e) => setIdInstance(e.target.value)}
              aria-invalid={idError !== null}
              aria-describedby={idError ? `${ids}-id-error` : undefined}
              autoFocus
            />
            {idError && (
              <span id={`${ids}-id-error`} className={styles.fieldError}>
                {idError}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor={`${ids}-token`}>apiTokenInstance</label>
            <div className={styles.withAction}>
              <input
                id={`${ids}-token`}
                name="apiTokenInstance"
                type={showToken ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <button
                type="button"
                className={styles.inlineButton}
                onClick={() => setShowToken((v) => !v)}
                aria-pressed={showToken}
              >
                {showToken ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </div>

          <details className={styles.advanced}>
            <summary>Дополнительно</summary>
            <div className={styles.field}>
              <label htmlFor={`${ids}-url`}>apiUrl</label>
              <input
                id={`${ids}-url`}
                name="apiUrl"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://1234.api.green-api.com"
                value={apiUrl}
                onChange={(e) => setCustomApiUrl(e.target.value)}
                aria-invalid={urlError !== null}
                aria-describedby={`${ids}-url-hint`}
              />
              <span id={`${ids}-url-hint`} className={urlError ? styles.fieldError : styles.hint}>
                {urlError ??
                  'Определяется по idInstance. Меняйте, только если в кабинете указан другой'}
              </span>
            </div>
          </details>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={!canSubmit}>
            {pending ? 'Проверяем…' : 'Войти'}
          </button>
        </form>

        <p className={styles.note}>
          Используйте данные тестового инстанса. Токен хранится только в этой вкладке и удаляется
          при её закрытии или выходе.
        </p>
        {hint}
      </section>
    </main>
  )
}
