import { useCallback } from 'react'
import type { Chat } from '../../domain/types'
import { useChats } from '../../state/chats'
import { ChatHeader } from '../ChatHeader/ChatHeader'
import { Composer } from '../Composer/Composer'
import { MessageList } from '../MessageList/MessageList'
import styles from './ChatPane.module.css'

type Props = { chat: Chat }

export function ChatPane({ chat }: Props) {
  const { sendText, retry, selectChat } = useChats()
  const { chatId } = chat

  const handleRetry = useCallback((localId: string) => void retry(chatId, localId), [retry, chatId])
  const handleSend = useCallback((text: string) => void sendText(chatId, text), [sendText, chatId])
  const handleBack = useCallback(() => selectChat(null), [selectChat])

  return (
    <section className={styles.pane} aria-label={`Чат: ${chat.title}`}>
      <ChatHeader chat={chat} onBack={handleBack} />
      <MessageList chatId={chatId} messages={chat.messages} onRetry={handleRetry} />
      <Composer onSend={handleSend} />
    </section>
  )
}
