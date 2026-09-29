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

/** Segmented control built from toggle buttons: each option is reachable with Tab. */
export function ThemeSwitch({ value, onChange }: Props) {
  return (
    <div className={styles.switch} role="group" aria-label="Тема оформления">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={styles.option}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
