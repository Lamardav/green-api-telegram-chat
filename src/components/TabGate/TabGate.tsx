import { Fragment, useId, type ReactNode } from 'react'
import { useSession } from '../../state/session'
import { useTabOwnership } from '../../state/useTabOwnership'
import { AppMark } from '../icons'
import styles from './TabGate.module.css'

type Props = {
  idInstance: string
  children: ReactNode
}

/** Renders the chat only in the tab that owns the instance; other tabs offer to take over. */
export function TabGate({ idInstance, children }: Props) {
  const { status, epoch, takeOver } = useTabOwnership(`gac-chat-${idInstance}`)
  const { logout } = useSession()
  const titleId = useId()

  // Remount on every acquisition so the new owner starts from the latest saved history.
  if (status === 'owner') return <Fragment key={epoch}>{children}</Fragment>
  if (status === 'pending') return null

  return (
    <main className={styles.screen}>
      <section className={styles.card} aria-labelledby={titleId}>
        <AppMark className={styles.mark} />
        <h1 id={titleId} className={styles.title}>
          Чат открыт в другой вкладке
        </h1>
        <p className={styles.text}>
          Сообщения можно получать только в одной вкладке, иначе они разделятся между ними.
        </p>
        <button type="button" className={styles.primary} onClick={takeOver}>
          Открыть здесь
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => logout({ keepHistory: true })}
        >
          Выйти в этой вкладке
        </button>
      </section>
    </main>
  )
}
