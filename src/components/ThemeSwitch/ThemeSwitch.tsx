import type { Theme } from '../../services/storage'
import styles from './ThemeSwitch.module.css'

const OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: 'simple', label: 'Простая' },
  { value: 'space', label: 'Космос' },
]

type Props = {
  value: Theme
  onChange(theme: Theme): void
}

export function ThemeSwitch({ value, onChange }: Props) {
  return (
    <div className={styles.switch} role="radiogroup" aria-label="Тема оформления">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={styles.option}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
