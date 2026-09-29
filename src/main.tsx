import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { FetchLike } from './api/types'
import { App } from './App'
import './styles/tokens.css'
import './styles/global.css'

async function bootstrap() {
  let fetchImpl: FetchLike | undefined
  let loginHint: ReactNode

  // `MODE` is replaced at build time, so the simulator is tree-shaken out of production builds.
  if (import.meta.env.MODE === 'mock') {
    const { setupDemo } = await import('./mocks/demo')
    ;({ fetchImpl, loginHint } = setupDemo())
    document.title = `Демо · ${document.title}`
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App fetchImpl={fetchImpl} loginHint={loginHint} />
    </StrictMode>,
  )
}

void bootstrap()
