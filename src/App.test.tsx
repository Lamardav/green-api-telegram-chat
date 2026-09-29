import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './App'
import {
  createFakeGreenApi,
  FAKE_CHAT_ID,
  FAKE_ID_INSTANCE,
  FAKE_TOKEN,
  type FakeGreenApi,
} from './mocks/fakeGreenApi'
import { chatsKey } from './services/storage'

let fake: FakeGreenApi
afterEach(() => fake?.dispose())

const LONG = { timeout: 4000 }

/**
 * The acceptance scenario from the task, end to end through the UI:
 * sign in → create a chat by phone → send a text → recipient replies → reply is visible.
 */
describe('App acceptance scenario', () => {
  it('sends a message and shows the reply', async () => {
    fake = createFakeGreenApi({
      autoReply: true,
      replyDelayMs: 60,
      statusDelayMs: 5,
      settingsReady: false,
    })
    const user = userEvent.setup()
    // StrictMode double-invokes effects: polling and the tab lock must survive that.
    const view = render(
      <StrictMode>
        <App fetchImpl={fake.fetch} />
      </StrictMode>,
    )

    // 1. Sign in with GREEN-API credentials.
    await user.type(screen.getByLabelText('idInstance'), FAKE_ID_INSTANCE)
    await user.type(screen.getByLabelText('apiTokenInstance'), FAKE_TOKEN)
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    // Instance settings block receiving → enable them from the banner.
    await user.click(await screen.findByRole('button', { name: 'Включить получение' }))
    await user.click(await screen.findByRole('button', { name: 'Понятно' }))

    // 2. Create a new chat by the recipient's phone number.
    await user.click(screen.getByRole('button', { name: 'Новый чат' }))
    await user.type(screen.getByLabelText('Номер телефона получателя'), '+7 999 000-00-01{Enter}')
    const pane = await screen.findByRole('region', { name: 'Чат: +7 999 000-00-01' })
    expect(within(pane).getByText('Сообщений пока нет — напишите первым')).toBeInTheDocument()

    // 3. Write and send a text message.
    await user.type(within(pane).getByLabelText('Сообщение'), 'Привет из теста{Enter}')
    expect(await within(pane).findByText('Привет из теста')).toBeInTheDocument()
    expect(fake.sent).toEqual([
      expect.objectContaining({ chatId: FAKE_CHAT_ID, message: 'Привет из теста' }),
    ])

    // 4–5. The recipient answers in Telegram and the answer appears in the chat.
    expect(
      await within(pane).findByText('Эхо: Привет из теста', undefined, LONG),
    ).toBeInTheDocument()
    await waitFor(
      () => expect(within(pane).getByRole('img', { name: 'Прочитано' })).toBeInTheDocument(),
      LONG,
    )

    // The chat list shows the latest message.
    const list = screen.getByRole('complementary', { name: 'Чаты' })
    expect(within(list).getByText('Эхо: Привет из теста')).toBeInTheDocument()

    // History survives a reload of the page (same tab).
    view.unmount()
    render(<App fetchImpl={fake.fetch} />)
    expect(await screen.findByText('Эхо: Привет из теста', { selector: 'p' })).toBeInTheDocument()

    // Logging out removes credentials and this instance's history from the device.
    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument()
    expect(sessionStorage.getItem('gac:session')).toBeNull()
    expect(localStorage.getItem(chatsKey(FAKE_ID_INSTANCE))).toBeNull()
  })

  it('puts a message from an unknown sender into a new chat with an unread badge', async () => {
    fake = createFakeGreenApi()
    const user = userEvent.setup()
    render(<App fetchImpl={fake.fetch} />)
    await user.type(screen.getByLabelText('idInstance'), FAKE_ID_INSTANCE)
    await user.type(screen.getByLabelText('apiTokenInstance'), FAKE_TOKEN)
    await user.click(screen.getByRole('button', { name: 'Войти' }))
    expect(await screen.findByText('Чатов пока нет')).toBeInTheDocument()

    fake.pushIncoming('20000002', 'Вы меня не знаете', 'Пётр')
    const list = screen.getByRole('complementary', { name: 'Чаты' })
    expect(await within(list).findByText('Пётр', undefined, LONG)).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: /Пётр.*Непрочитанных: 1/ })).toBeInTheDocument()

    await user.click(within(list).getByRole('button', { name: /Пётр/ }))
    expect(screen.getByRole('region', { name: 'Чат: Пётр' })).toBeInTheDocument()
    expect(within(list).queryByText('Непрочитанных:', { exact: false })).not.toBeInTheDocument()
  })
})
