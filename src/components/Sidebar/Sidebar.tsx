import { useEffect, useRef, useState } from 'react'
import type { Theme } from '../../services/storage'
import { useChats } from '../../state/chats'
import { useSession } from '../../state/session'
import { ChatListItem } from '../ChatListItem/ChatListItem'
import { LogoutIcon, PlusIcon } from '../icons'
import { NewChatForm } from '../NewChatForm/NewChatForm'
import { ThemeSwitch } from '../ThemeSwitch/ThemeSwitch'
import styles from './Sidebar.module.css'

type Props = {
  theme: Theme
  onThemeChange(theme: Theme): void
}

export function Sidebar({ theme, onThemeChange }: Props) {
  const { credentials, logout } = useSession()
  const { state, connection, storageOk, openChatByPhone, selectChat } = useChats()
  const [creating, setCreating] = useState(false)
  const newChatButton = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const previousActive = useRef(state.activeChatId)
  const chats = state.order.map((id) => state.chats[id]).filter((c) => c !== undefined)

  // Coming back from a conversation (mobile "back") returns focus to that chat in the list.
  useEffect(() => {
    const previous = previousActive.current
    previousActive.current = state.activeChatId
    if (previous === null || state.activeChatId !== null) return
    const items = list.current?.querySelectorAll<HTMLButtonElement>('button[data-chat-id]') ?? []
    Array.from(items)
      .find((item) => item.dataset.chatId === previous)
      ?.focus()
  }, [state.activeChatId])

  const cancelNewChat = () => {
    setCreating(false)
    newChatButton.current?.focus()
  }

  return (
    <aside className={styles.sidebar} aria-label="Чаты">
      <header className={styles.header}>
        <h1 className={styles.title}>Чаты</h1>
        <button
          ref={newChatButton}
          type="button"
          className={styles.iconButton}
          onClick={() => setCreating((v) => !v)}
          aria-expanded={creating}
          aria-label="Новый чат"
          title="Новый чат"
        >
          <PlusIcon />
        </button>
      </header>

      {connection === 'retrying' && (
        <p className={styles.notice} role="status">
          Нет связи с GREEN-API. Переподключаемся…
        </p>
      )}
      {!storageOk && (
        <p className={styles.notice} role="status">
          История не сохраняется: хранилище браузера недоступно или переполнено
        </p>
      )}

      {creating && (
        <NewChatForm
          onSubmit={openChatByPhone}
          onDone={() => setCreating(false)}
          onCancel={cancelNewChat}
        />
      )}

      {chats.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Чатов пока нет</p>
          <p>Нажмите «+», введите номер получателя и напишите первое сообщение</p>
          {!creating && (
            <button type="button" className={styles.emptyButton} onClick={() => setCreating(true)}>
              Создать первый чат
            </button>
          )}
        </div>
      ) : (
        <ul ref={list} className={styles.list}>
          {chats.map((chat) => (
            <ChatListItem
              key={chat.chatId}
              chat={chat}
              active={chat.chatId === state.activeChatId}
              onSelect={selectChat}
            />
          ))}
        </ul>
      )}

      <footer className={styles.footer}>
        <span className={styles.instance} title="idInstance">
          ID {credentials?.idInstance}
        </span>
        <ThemeSwitch value={theme} onChange={onThemeChange} />
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => logout()}
          aria-label="Выйти"
          title="Выйти (история этого инстанса будет удалена с устройства)"
        >
          <LogoutIcon />
        </button>
      </footer>
    </aside>
  )
}
