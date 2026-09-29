import type { Chat } from '../../domain/types'
import { formatPhone } from '../../domain/phone'
import { Avatar } from '../Avatar/Avatar'
import { BackIcon } from '../icons'
import styles from './ChatHeader.module.css'

type Props = {
  chat: Chat
  onBack(): void
}

export function ChatHeader({ chat, onBack }: Props) {
  const phone = chat.phone ? formatPhone(chat.phone) : null
  const subtitle = phone && phone !== chat.title ? phone : 'Telegram'

  return (
    <header className={styles.header}>
      <button type="button" className={styles.back} onClick={onBack} aria-label="Назад к чатам">
        <BackIcon />
      </button>
      <Avatar id={chat.chatId} title={chat.title} size={40} />
      <div className={styles.text}>
        <h2 className={styles.title}>{chat.title}</h2>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
    </header>
  )
}
