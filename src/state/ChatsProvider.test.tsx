import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayoutEffect } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { SettingsBanner } from '../components/SettingsBanner/SettingsBanner'
import {
  createFakeGreenApi,
  FAKE_CHAT_ID,
  FAKE_ID_INSTANCE,
  FAKE_PHONE,
  FAKE_TOKEN,
  type FakeGreenApi,
  type FakeOptions,
} from '../mocks/fakeGreenApi'
import { chatsKey, saveSession } from '../services/storage'
import { useChats, type ChatsValue } from './chats'
import { ChatsProvider } from './ChatsProvider'
import { useSession } from './session'
import { SessionProvider } from './SessionProvider'

let fake: FakeGreenApi
afterEach(() => fake?.dispose())

let chats: ChatsValue
function Capture() {
  const value = useChats()
  useLayoutEffect(() => {
    chats = value
  })
  return null
}

function SessionState() {
  const { credentials, logoutReason } = useSession()
  return <p data-testid="session">{credentials ? 'in' : `out:${logoutReason ?? ''}`}</p>
}

function Gate() {
  const { credentials } = useSession()
  return credentials ? (
    <ChatsProvider key={credentials.idInstance}>
      <SettingsBanner />
      <Capture />
    </ChatsProvider>
  ) : null
}

function renderChats(options: FakeOptions = {}) {
  fake = createFakeGreenApi({ statusDelayMs: 5, replyDelayMs: 40, ...options })
  saveSession({
    idInstance: FAKE_ID_INSTANCE,
    apiTokenInstance: FAKE_TOKEN,
    apiUrl: 'https://1101.api.green-api.com',
  })
  render(
    <SessionProvider fetchImpl={fake.fetch}>
      <SessionState />
      <Gate />
    </SessionProvider>,
  )
}

const chat = (chatId = FAKE_CHAT_ID) => chats.state.chats[chatId]

describe('ChatsProvider', () => {
  it('asks to enable notifications, then starts receiving', async () => {
    renderChats({ settingsReady: false })
    const button = await screen.findByRole('button', { name: 'Включить получение' })
    expect(screen.getByText(/https:\/\/example\.com\/hook/)).toBeInTheDocument()
    expect(fake.calls).not.toContain('receiveNotification')

    await userEvent.click(button)
    expect(await screen.findByText(/Настройки сохранены/)).toBeInTheDocument()
    expect(fake.settings).toMatchObject({
      webhookUrl: '',
      incomingWebhook: 'yes',
      outgoingWebhook: 'yes',
    })

    fake.pushIncoming('555', 'Здравствуйте', 'Незнакомец')
    await waitFor(() => expect(chat('555')?.messages[0]?.text).toBe('Здравствуйте'))
    expect(chat('555')).toMatchObject({ title: 'Незнакомец', unread: 1 })
  })

  it('opens a chat by phone, sends, tracks statuses and receives the reply', async () => {
    renderChats({ autoReply: true })
    await waitFor(() => expect(chats.settings).toBe('ready'))

    let result
    await act(async () => {
      result = await chats.openChatByPhone('+7 999 000-00-01')
    })
    expect(result).toEqual({ ok: true })
    expect(chats.state.activeChatId).toBe(FAKE_CHAT_ID)
    expect(chat()).toMatchObject({ title: '+7 999 000-00-01', phone: FAKE_PHONE })

    await act(() => chats.sendText(FAKE_CHAT_ID, '  Привет  '))
    expect(fake.sent).toEqual([
      expect.objectContaining({ chatId: FAKE_CHAT_ID, message: 'Привет' }),
    ])

    await waitFor(() =>
      expect(chat()!.messages.map((m) => m.text)).toEqual(['Привет', 'Эхо: Привет']),
    )
    await waitFor(() => expect(chat()!.messages[0]!.status).toBe('read'))
    expect(chat()!.unread).toBe(0) // reply landed in the open chat
  })

  it('reuses a known chat without calling CheckAccount again', async () => {
    renderChats()
    await waitFor(() => expect(chats.settings).toBe('ready'))
    await act(async () => void (await chats.openChatByPhone(FAKE_PHONE)))
    await act(async () => void (await chats.openChatByPhone('+7 (999) 000-00-01')))
    expect(fake.calls.filter((c) => c === 'checkAccount')).toHaveLength(1)
  })

  it('reports numbers without Telegram and invalid input', async () => {
    renderChats()
    await waitFor(() => expect(chats.settings).toBe('ready'))
    let result
    await act(async () => {
      result = await chats.openChatByPhone('+7 999 000-99-99')
    })
    expect(result).toEqual({
      ok: false,
      error: 'У этого номера нет Telegram или он скрыт настройками приватности',
    })
    await act(async () => {
      result = await chats.openChatByPhone('123')
    })
    expect(result).toEqual({ ok: false, error: 'Номер должен содержать от 10 до 15 цифр' })
    expect(fake.calls.filter((c) => c === 'checkAccount')).toHaveLength(1)
  })

  it('reports the tariff quota', async () => {
    renderChats()
    await waitFor(() => expect(chats.settings).toBe('ready'))
    fake.failNext('checkAccount', 466, '{}')
    let result
    await act(async () => {
      result = await chats.openChatByPhone(FAKE_PHONE)
    })
    expect(result).toEqual({
      ok: false,
      error: 'Достигнут лимит тарифа Developer (3 чата / 100 проверок номера в месяц)',
    })
  })

  it('marks a failed send and retries it', async () => {
    renderChats()
    await waitFor(() => expect(chats.settings).toBe('ready'))
    await act(async () => void (await chats.openChatByPhone(FAKE_PHONE)))

    fake.failNext('sendMessage', 0)
    await act(() => chats.sendText(FAKE_CHAT_ID, 'раз'))
    const failed = chat()!.messages[0]!
    expect(failed).toMatchObject({ status: 'failed', error: expect.stringContaining('Не удалось') })

    await act(() => chats.retry(FAKE_CHAT_ID, failed.localId))
    expect(chat()!.messages).toHaveLength(1)
    expect(chat()!.messages[0]).toMatchObject({ status: 'sent', localId: failed.localId })
    expect(chat()!.messages[0]!.error).toBeUndefined()
  })

  it('does not send blank or oversized messages', async () => {
    renderChats()
    await waitFor(() => expect(chats.settings).toBe('ready'))
    await act(async () => void (await chats.openChatByPhone(FAKE_PHONE)))
    await act(() => chats.sendText(FAKE_CHAT_ID, '   '))
    await act(() => chats.sendText(FAKE_CHAT_ID, 'x'.repeat(4097)))
    expect(fake.sent).toHaveLength(0)
    expect(chat()!.messages).toHaveLength(0)
  })

  it('persists history per instance', async () => {
    renderChats()
    await waitFor(() => expect(chats.settings).toBe('ready'))
    fake.pushIncoming(FAKE_CHAT_ID, 'сохрани меня')
    await waitFor(() => expect(chat()?.messages).toHaveLength(1))
    await waitFor(() =>
      expect(localStorage.getItem(chatsKey(FAKE_ID_INSTANCE))).toContain('сохрани меня'),
    )
  })

  it('signs out, keeping history, when the token stops working', async () => {
    renderChats()
    await waitFor(() => expect(chats.settings).toBe('ready'))
    fake.pushIncoming(FAKE_CHAT_ID, 'история')
    await waitFor(() => expect(chat()?.messages).toHaveLength(1))

    fake.failNext('receiveNotification', 401, 'Unauthorized', 5)
    await waitFor(
      () => expect(screen.getByTestId('session')).toHaveTextContent('out:Сессия недействительна'),
      { timeout: 3000 }, // the in-flight long poll has to finish first
    )
    expect(sessionStorage.getItem('gac:session')).toBeNull()
    expect(localStorage.getItem(chatsKey(FAKE_ID_INSTANCE))).toContain('история')
  })

  it('mirrors changes written by another tab', async () => {
    renderChats()
    await waitFor(() => expect(chats.settings).toBe('ready'))
    const key = chatsKey(FAKE_ID_INSTANCE)
    const remote = {
      chats: {
        '777': {
          chatId: '777',
          title: 'Из другой вкладки',
          messages: [],
          unread: 0,
          lastActivity: 5,
        },
      },
      order: ['777'],
      activeChatId: '777',
    }
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(remote) }))
    })
    expect(chat('777')?.title).toBe('Из другой вкладки')
    expect(chats.state.activeChatId).toBeNull()
  })
})
