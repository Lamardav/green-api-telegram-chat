import type { Chat } from '../../domain/types'
import { useChats } from '../../state/chats'
import { ChatHeader } from '../ChatHeader/ChatHeader'
import { Composer } from '../Composer/Composer'
import { MessageList } from '../MessageList/MessageList'
import styles from './ChatPane.module.css'

type Props = { chat: Chat }

export function ChatPane({ chat }: Props) {
  const { sendText, retry, selectChat } = useChats()

  return (
    <section className={styles.pane} aria-label={`Чат: ${chat.title}`}>
      <ChatHeader chat={chat} onBack={() => selectChat(null)} />
      <MessageList
        chatId={chat.chatId}
        messages={chat.messages}
        onRetry={(localId) => void retry(chat.chatId, localId)}
      />
      <Composer key={chat.chatId} onSend={(text) => void sendText(chat.chatId, text)} />
    </section>
  )
}
