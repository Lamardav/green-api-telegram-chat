import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

type Props = { children: ReactNode }
type State = { failed: boolean }

/** Last line of defence: a rendering error shows a recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Unhandled rendering error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className={styles.screen} role="alert">
        <h1 className={styles.title}>Что-то пошло не так</h1>
        <p className={styles.text}>Перезагрузите страницу. История переписки сохранена.</p>
        <button type="button" className={styles.button} onClick={() => window.location.reload()}>
          Перезагрузить
        </button>
      </main>
    )
  }
}
