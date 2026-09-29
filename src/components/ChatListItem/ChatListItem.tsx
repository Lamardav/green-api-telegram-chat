import { memo } from 'react'
import type { Chat } from '../../domain/types'
import { formatListTime } from '../../domain/time'
import { Avatar } from '../Avatar/Avatar'
import styles from './ChatListItem.module.css'

type Props = {
  chat: Chat
  active: boolean
  onSelect(chatId: string): void
}

export const ChatListItem = memo(function ChatListItem({ chat, active, onSelect }: Props) {
  const last = chat.messages.at(-1)
  const preview = last ? `${last.direction === 'out' ? 'Вы: ' : ''}${last.text}` : 'Нет сообщений'

  return (
    <li>
      <button
        type="button"
        className={styles.item}
        aria-current={active ? 'true' : undefined}
        data-chat-id={chat.chatId}
        onClick={() => onSelect(chat.chatId)}
      >
        <Avatar id={chat.chatId} title={chat.title} />
        <span className={styles.body}>
          <span className={styles.row}>
            <span className={styles.title}>{chat.title}</span>
            {last && (
              <time className={styles.time} dateTime={new Date(last.timestamp).toISOString()}>
                {formatListTime(last.timestamp)}
              </time>
            )}
          </span>
          <span className={styles.row}>
            <span className={styles.preview}>{preview}</span>
            {chat.unread > 0 && (
              <span className={styles.badge}>
                <span className="visually-hidden">{`Непрочитанных: ${chat.unread}`}</span>
                <span aria-hidden>{chat.unread > 99 ? '99+' : chat.unread}</span>
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  )
})
