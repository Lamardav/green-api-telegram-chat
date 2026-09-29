import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { saveSession } from '../../services/storage'
import { SessionProvider } from '../../state/SessionProvider'
import { installFakeLocks } from '../../test/fakeLocks'
import { TabGate } from './TabGate'

let locks: ReturnType<typeof installFakeLocks>
beforeEach(() => {
  locks = installFakeLocks()
  saveSession({ idInstance: '1', apiTokenInstance: 't', apiUrl: 'https://h.test' })
})
afterEach(() => locks.uninstall())

/** Two "tabs" in one document: they share the fake lock manager like real tabs share the browser's. */
function renderTabs() {
  render(
    <SessionProvider>
      <div data-testid="tab-a">
        <TabGate idInstance="1">
          <p>чат во вкладке A</p>
        </TabGate>
      </div>
      <div data-testid="tab-b">
        <TabGate idInstance="1">
          <p>чат во вкладке B</p>
        </TabGate>
      </div>
    </SessionProvider>,
  )
}

describe('TabGate', () => {
  it('shows the chat in one tab and a take-over screen in the other', async () => {
    renderTabs()
    expect(await screen.findByText('чат во вкладке A')).toBeInTheDocument()
    expect(await screen.findByText('Чат открыт в другой вкладке')).toBeInTheDocument()
    expect(screen.queryByText('чат во вкладке B')).not.toBeInTheDocument()
  })

  it('moves the chat to the tab that takes over', async () => {
    renderTabs()
    await userEvent.click(await screen.findByRole('button', { name: 'Открыть здесь' }))
    expect(await screen.findByText('чат во вкладке B')).toBeInTheDocument()
    expect(screen.queryByText('чат во вкладке A')).not.toBeInTheDocument()
    expect(screen.getAllByText('Чат открыт в другой вкладке')).toHaveLength(1)
  })

  it('renders directly when there is no competing tab', async () => {
    render(
      <SessionProvider>
        <TabGate idInstance="2">
          <p>единственная вкладка</p>
        </TabGate>
      </SessionProvider>,
    )
    expect(await screen.findByText('единственная вкладка')).toBeInTheDocument()
  })
})
