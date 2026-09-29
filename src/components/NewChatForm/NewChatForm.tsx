import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { OpenChatResult } from '../../state/chats'
import styles from './NewChatForm.module.css'

type Props = {
  onSubmit(phone: string): Promise<OpenChatResult>
  /** The chat was opened. */
  onDone(): void
  onCancel(): void
}

export function NewChatForm({ onSubmit, onDone, onCancel }: Props) {
  const id = useId()
  const [phone, setPhone] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    const result = await onSubmit(phone)
    if (result.ok) {
      onDone()
    } else {
      setError(result.error)
      setPending(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') onCancel()
  }

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      aria-label="Новый чат"
      noValidate
    >
      <label htmlFor={`${id}-phone`} className={styles.label}>
        Номер телефона получателя
      </label>
      <input
        id={`${id}-phone`}
        className={styles.input}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder="+7 999 123-45-67"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value)
          setError(null)
        }}
        aria-invalid={error !== null}
        aria-describedby={`${id}-hint`}
        disabled={pending}
        autoFocus
      />
      <p
        id={`${id}-hint`}
        className={error ? styles.error : styles.hint}
        role={error ? 'alert' : undefined}
      >
        {error ?? 'В международном формате, с кодом страны'}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className={styles.primary} disabled={pending || phone.trim() === ''}>
          {pending ? 'Ищем…' : 'Создать чат'}
        </button>
      </div>
    </form>
  )
}
