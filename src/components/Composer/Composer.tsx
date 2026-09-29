import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { MAX_MESSAGE_LENGTH } from '../../state/chats'
import { SendIcon } from '../icons'
import styles from './Composer.module.css'

type Props = {
  onSend(text: string): void
}

const COUNTER_THRESHOLD = MAX_MESSAGE_LENGTH - 196

export function Composer({ onSend }: Props) {
  const id = useId()
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const canSend = text.trim() !== '' && text.length <= MAX_MESSAGE_LENGTH

  // Grow with the content up to the CSS max-height (10 lines), then scroll.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  // Focus on open, except on touch devices where it would pop the keyboard unasked.
  useEffect(() => {
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    if (!coarse) ref.current?.focus()
  }, [])

  function send() {
    if (!canSend) return
    onSend(text)
    setText('')
    ref.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  return (
    <form
      className={styles.composer}
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
    >
      <label htmlFor={`${id}-input`} className="visually-hidden">
        Сообщение
      </label>
      <textarea
        id={`${id}-input`}
        ref={ref}
        className={styles.input}
        rows={1}
        placeholder="Сообщение..."
        value={text}
        maxLength={MAX_MESSAGE_LENGTH}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-describedby={text.length > COUNTER_THRESHOLD ? `${id}-counter` : undefined}
      />
      {text.length > COUNTER_THRESHOLD && (
        <span id={`${id}-counter`} className={styles.counter}>
          {text.length}/{MAX_MESSAGE_LENGTH}
        </span>
      )}
      <button type="submit" className={styles.send} disabled={!canSend} aria-label="Отправить">
        <SendIcon />
      </button>
    </form>
  )
}
