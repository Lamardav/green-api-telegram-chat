import { useChats } from '../../state/chats'
import { AlertIcon } from '../icons'
import styles from './SettingsBanner.module.css'

export function SettingsBanner() {
  const {
    settings,
    webhookUrl,
    settingsError,
    enableNotifications,
    recheckSettings,
    dismissSettingsNotice,
  } = useChats()

  if (settings === 'checking' || settings === 'ready') return null

  if (settings === 'applied') {
    return (
      <div className={`${styles.banner} ${styles.info}`} role="status">
        <p className={styles.text}>
          Настройки сохранены. Инстанс перезапускается — новые сообщения начнут приходить в течение
          5 минут.
        </p>
        <button type="button" className={styles.secondary} onClick={dismissSettingsNotice}>
          Понятно
        </button>
      </div>
    )
  }

  if (settings === 'error') {
    return (
      <div className={`${styles.banner} ${styles.warning}`} role="status">
        <AlertIcon className={styles.icon} />
        <p className={styles.text}>Не удалось проверить настройки инстанса. {settingsError}</p>
        <button type="button" className={styles.secondary} onClick={recheckSettings}>
          Повторить
        </button>
      </div>
    )
  }

  const applying = settings === 'applying'
  return (
    <div className={`${styles.banner} ${styles.warning}`} role="status">
      <AlertIcon className={styles.icon} />
      <div className={styles.text}>
        <p className={styles.title}>Получение сообщений выключено в настройках инстанса</p>
        <p>
          Приложение получает ответы через HTTP API GREEN-API.{' '}
          {webhookUrl && (
            <>
              Текущий webhook <code className={styles.code}>{webhookUrl}</code> будет отключён.{' '}
            </>
          )}
          Инстанс перезапустится, настройки применяются до 5 минут.
        </p>
        {settingsError && <p className={styles.error}>{settingsError}</p>}
      </div>
      <button
        type="button"
        className={styles.primary}
        onClick={() => void enableNotifications()}
        disabled={applying}
      >
        {applying ? 'Сохраняем…' : 'Включить получение'}
      </button>
    </div>
  )
}
