import { Fragment, useLayoutEffect, useRef } from 'react'
import type { Message } from '../../domain/types'
import { formatDayLabel, isSameDay } from '../../domain/time'
import { MessageBubble } from '../MessageBubble/MessageBubble'
import styles from './MessageList.module.css'

type Props = {
  chatId: string
  messages: Message[]
  onRetry(localId: string): void
}

const GROUP_WINDOW_MS = 5 * 60_000
const NEAR_BOTTOM_PX = 120

const sameGroup = (a: Message | undefined, b: Message | undefined) =>
  a !== undefined &&
  b !== undefined &&
  a.direction === b.direction &&
  isSameDay(a.timestamp, b.timestamp) &&
  Math.abs(b.timestamp - a.timestamp) < GROUP_WINDOW_MS

export function MessageList({ chatId, messages, onRetry }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const lastSeen = useRef<string | null>(null)
  const last = messages.at(-1)

  // A newly opened chat starts at the latest message.
  useLayoutEffect(() => {
    stickToBottom.current = true
    lastSeen.current = null
  }, [chatId])

  // Scroll only when a new message arrives (not on status updates), and not while the user
  // is reading history above — except for their own messages.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || !last || last.localId === lastSeen.current) return
    lastSeen.current = last.localId
    if (stickToBottom.current || last.direction === 'out') el.scrollTop = el.scrollHeight
  }, [chatId, last])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  if (messages.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Сообщений пока нет — напишите первым</p>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className={styles.scroll}
      onScroll={handleScroll}
      role="log"
      aria-label="Сообщения"
    >
      <div className={styles.column}>
        {messages.map((message, index) => {
          const prev = messages[index - 1]
          const next = messages[index + 1]
          const newDay = !prev || !isSameDay(prev.timestamp, message.timestamp)
          return (
            <Fragment key={message.localId}>
              {newDay && (
                <div className={styles.day}>
                  <span>{formatDayLabel(message.timestamp)}</span>
                </div>
              )}
              <div className={sameGroup(prev, message) ? styles.stacked : styles.separated}>
                <MessageBubble
                  message={message}
                  groupStart={!sameGroup(prev, message)}
                  groupEnd={!sameGroup(message, next)}
                  onRetry={onRetry}
                />
              </div>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
