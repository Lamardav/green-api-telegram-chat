import { avatarGradient, initials } from '../../domain/avatar'
import { PersonIcon } from '../icons'
import styles from './Avatar.module.css'

type Props = {
  id: string
  title: string
  size?: 40 | 48
}

export function Avatar({ id, title, size = 48 }: Props) {
  const letters = initials(title)
  return (
    <span
      className={styles.avatar}
      style={{ background: avatarGradient(id), width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {letters || <PersonIcon className={styles.icon} />}
    </span>
  )
}
