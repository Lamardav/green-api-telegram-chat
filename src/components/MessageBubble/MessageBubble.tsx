import type { Message, MessageStatus } from '../../domain/types'
import { formatTime } from '../../domain/time'
import { AlertIcon, CheckIcon, ClockIcon, DoubleCheckIcon } from '../icons'
import styles from './MessageBubble.module.css'

type Props = {
  message: Message
  /** Position inside a run of consecutive messages from the same side. */
  groupStart: boolean
  groupEnd: boolean
  onRetry(localId: string): void
}

const STATUS_LABEL: Record<MessageStatus, string> = {
  pending: 'Отправляется',
  sent: 'Отправлено',
  delivered: 'Доставлено',
  read: 'Прочитано',
  failed: 'Ошибка отправки',
}

function StatusIcon({ status }: { status: MessageStatus }) {
  const label = STATUS_LABEL[status]
  const icon = {
    pending: <ClockIcon />,
    sent: <CheckIcon />,
    delivered: <DoubleCheckIcon />,
    read: <DoubleCheckIcon />,
    failed: <AlertIcon />,
  }[status]
  return (
    <span
      className={styles.status}
      data-status={status}
      role="img"
      aria-label={label}
      title={label}
    >
      {icon}
    </span>
  )
}

export function MessageBubble({ message, groupStart, groupEnd, onRetry }: Props) {
  const outgoing = message.direction === 'out'
  const status = outgoing ? (message.status ?? 'sent') : null

  return (
    <div className={styles.row} data-direction={message.direction}>
      <div
        className={styles.bubble}
        data-direction={message.direction}
        data-group-start={groupStart || undefined}
        data-group-end={groupEnd || undefined}
        data-failed={status === 'failed' || undefined}
      >
        <p className={styles.text}>
          {message.text}
          <span className={styles.spacer} data-with-status={outgoing || undefined} aria-hidden />
        </p>
        <span className={styles.meta}>
          <time dateTime={new Date(message.timestamp).toISOString()}>
            {formatTime(message.timestamp)}
          </time>
          {status && <StatusIcon status={status} />}
        </span>
      </div>
      {status === 'failed' && (
        <div className={styles.failure}>
          <span>{message.error ?? 'Сообщение не отправлено'}</span>
          <button type="button" onClick={() => onRetry(message.localId)}>
            Повторить
          </button>
        </div>
      )}
    </div>
  )
}
