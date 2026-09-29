import { useState, type ReactNode } from 'react'
import type { FetchLike } from './api/types'
import { ChatLayout } from './components/ChatLayout/ChatLayout'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary'
import { LoginScreen } from './components/LoginScreen/LoginScreen'
import { TabGate } from './components/TabGate/TabGate'
import { loadTheme, saveTheme, type Theme } from './services/storage'
import { ChatsProvider } from './state/ChatsProvider'
import { useSession } from './state/session'
import { SessionProvider } from './state/SessionProvider'

type Props = {
  fetchImpl?: FetchLike
  loginHint?: ReactNode
}

export function App({ fetchImpl, loginHint }: Props) {
  return (
    <ErrorBoundary>
      <SessionProvider fetchImpl={fetchImpl}>
        <Screens loginHint={loginHint} />
      </SessionProvider>
    </ErrorBoundary>
  )
}

function Screens({ loginHint }: { loginHint: ReactNode }) {
  const { credentials } = useSession()
  const [theme, setTheme] = useState<Theme>(loadTheme)

  const changeTheme = (next: Theme) => {
    setTheme(next)
    saveTheme(next)
  }

  if (!credentials) return <LoginScreen hint={loginHint} />
  return (
    // Keyed by instance so switching accounts never mixes chat state.
    <TabGate key={credentials.idInstance} idInstance={credentials.idInstance}>
      <ChatsProvider>
        <ChatLayout theme={theme} onThemeChange={changeTheme} />
      </ChatsProvider>
    </TabGate>
  )
}
