import { describe, expect, it, vi } from 'vitest'
import { chatReducer, initialChatsState } from '../domain/chatReducer'
import {
  chatsKey,
  clearChats,
  clearSession,
  INTERRUPTED_SEND,
  loadChats,
  loadSession,
  loadTheme,
  MAX_STORED_MESSAGES_PER_CHAT,
  saveChats,
  saveSession,
  saveTheme,
} from './storage'

const creds = { idInstance: '4100000001', apiTokenInstance: 'T', apiUrl: 'https://h.test' }

describe('session', () => {
  it('round-trips credentials through sessionStorage', () => {
    saveSession(creds)
    expect(sessionStorage.getItem('gac:session')).not.toBeNull()
    expect(localStorage.length).toBe(0)
    expect(loadSession()).toEqual(creds)
    clearSession()
    expect(loadSession()).toBeNull()
  })

  it('returns null for corrupt or incomplete data', () => {
    sessionStorage.setItem('gac:session', '{bad')
    expect(loadSession()).toBeNull()
    sessionStorage.setItem('gac:session', JSON.stringify({ idInstance: '1' }))
    expect(loadSession()).toBeNull()
  })

  it('survives a storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(() => saveSession(creds)).not.toThrow()
    expect(loadSession()).toBeNull()
  })
})

describe('chats', () => {
  const state = [
    { type: 'chatOpened', chatId: '1', title: '+1', now: 10 } as const,
    { type: 'messageQueued', chatId: '1', localId: 'L1', text: 'hi', now: 20 } as const,
    { type: 'messageSent', chatId: '1', localId: 'L1', idMessage: 'M1' } as const,
    {
      type: 'outgoingStatus',
      event: { type: 'outgoingStatus', chatId: '9', idMessage: 'X', status: 'read' },
    } as const,
  ].reduce(chatReducer, initialChatsState)

  it('is stored per instance and drops buffered statuses', () => {
    saveChats('4100000001', state)
    expect(localStorage.getItem(chatsKey('4100000001'))).not.toBeNull()
    expect(loadChats('4100000002')).toBeNull()
    expect(loadChats('4100000001')).toEqual({ ...state, pendingStatuses: [] })
  })

  it('marks messages that were still sending as failed so they can be retried', () => {
    const sending = chatReducer(state, {
      type: 'messageQueued',
      chatId: '1',
      localId: 'L2',
      text: 'in flight',
      now: 30,
    })
    saveChats('4100000001', sending)
    const restored = loadChats('4100000001')!
    expect(restored.chats['1']!.messages[1]).toMatchObject({
      localId: 'L2',
      status: 'failed',
      error: INTERRUPTED_SEND,
    })
  })

  it('stores only the latest messages of a long chat', () => {
    const long = Array.from({ length: MAX_STORED_MESSAGES_PER_CHAT + 20 }, (_, i) => ({
      type: 'incomingText' as const,
      event: {
        type: 'incomingText' as const,
        chatId: '1',
        idMessage: `in-${i}`,
        text: String(i),
        timestamp: 1000 + i,
        senderName: 'A',
      },
    })).reduce(chatReducer, state)
    saveChats('4100000001', long)
    const restored = loadChats('4100000001')!.chats['1']!.messages
    expect(restored).toHaveLength(MAX_STORED_MESSAGES_PER_CHAT)
    expect(restored.at(-1)!.text).toBe(String(MAX_STORED_MESSAGES_PER_CHAT + 19))
  })

  it('reports a refused write', () => {
    expect(saveChats('4100000001', state)).toBe(true)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(saveChats('4100000001', state)).toBe(false)
  })

  it('discards malformed data', () => {
    localStorage.setItem(chatsKey('1'), JSON.stringify({ chats: 'nope' }))
    expect(loadChats('1')).toBeNull()
    localStorage.setItem(chatsKey('1'), '{bad')
    expect(loadChats('1')).toBeNull()
  })

  it('drops invalid chats and messages instead of failing entirely', () => {
    localStorage.setItem(
      chatsKey('1'),
      JSON.stringify({
        chats: {
          a: {
            chatId: 'a',
            title: 'A',
            unread: 0,
            lastActivity: 1,
            messages: [
              { localId: 'x', direction: 'in', text: 'ok', timestamp: 1 },
              { bogus: true },
            ],
          },
          b: { chatId: 'b' },
        },
        order: ['a', 'b', 'ghost'],
        activeChatId: 'b',
      }),
    )
    const restored = loadChats('1')!
    expect(Object.keys(restored.chats)).toEqual(['a'])
    expect(restored.chats.a!.messages).toHaveLength(1)
    expect(restored.order).toEqual(['a'])
    expect(restored.activeChatId).toBeNull()
  })

  it('clears one instance', () => {
    saveChats('1', state)
    clearChats('1')
    expect(loadChats('1')).toBeNull()
  })
})

describe('theme', () => {
  it('defaults to simple and remembers the choice', () => {
    expect(loadTheme()).toBe('simple')
    saveTheme('space')
    expect(loadTheme()).toBe('space')
    localStorage.setItem('gac:theme', 'neon')
    expect(loadTheme()).toBe('simple')
  })
})
