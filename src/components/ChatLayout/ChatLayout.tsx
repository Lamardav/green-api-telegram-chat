import type { Theme } from '../../services/storage'
import { useChats } from '../../state/chats'
import { ChatPane } from '../ChatPane/ChatPane'
import { SettingsBanner } from '../SettingsBanner/SettingsBanner'
import { Sidebar } from '../Sidebar/Sidebar'
import styles from './ChatLayout.module.css'

type Props = {
  theme: Theme
  onThemeChange(theme: Theme): void
}

export function ChatLayout({ theme, onThemeChange }: Props) {
  const { state } = useChats()
  const active = state.activeChatId ? state.chats[state.activeChatId] : undefined

  return (
    <div className={styles.layout} data-theme={theme} data-view={active ? 'chat' : 'list'}>
      <div className={styles.banner}>
        <SettingsBanner />
      </div>
      <div className={styles.sidebar}>
        <Sidebar theme={theme} onThemeChange={onThemeChange} />
      </div>
      <main className={styles.main}>
        {active ? (
          <ChatPane key={active.chatId} chat={active} />
        ) : (
          <div className={styles.placeholder}>
            <p>Выберите чат или создайте новый</p>
          </div>
        )}
      </main>
    </div>
  )
}
