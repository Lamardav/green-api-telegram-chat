import { describe, expect, it } from 'vitest'
import type { IncomingTextEvent, OutgoingStatusEvent } from '../api/notifications'
import {
  BACKLOG_THRESHOLD_MS,
  chatReducer,
  initialChatsState,
  MAX_PENDING_STATUSES,
  type ChatAction,
} from './chatReducer'
import type { ChatsState } from './types'

const deepFreeze = <T>(value: T): T => {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

const run = (actions: ChatAction[], from: ChatsState = initialChatsState) =>
  actions.reduce((state, action) => chatReducer(deepFreeze(state), action), from)

const open = (chatId: string, now = 1000, title = `+${chatId}`): ChatAction => ({
  type: 'chatOpened',
  chatId,
  title,
  phone: chatId,
  now,
})

const incoming = (patch: Partial<IncomingTextEvent> = {}): ChatAction => ({
  type: 'incomingText',
  event: {
    type: 'incomingText',
    chatId: '1',
    idMessage: 'in-1',
    text: 'Привет',
    timestamp: 2000,
    senderName: 'Вася',
    ...patch,
  },
})

const status = (
  idMessage: string,
  value: OutgoingStatusEvent['status'],
  chatId = '1',
): ChatAction => ({
  type: 'outgoingStatus',
  event: { type: 'outgoingStatus', chatId, idMessage, status: value },
})

const queued = (localId = 'L1', text = 'hi', now = 1500): ChatAction => ({
  type: 'messageQueued',
  chatId: '1',
  localId,
  text,
  now,
})

const sent = (idMessage = 'M1', localId = 'L1'): ChatAction => ({
  type: 'messageSent',
  chatId: '1',
  localId,
  idMessage,
})

const outMessage = (state: ChatsState, localId = 'L1') =>
  state.chats['1']!.messages.find((m) => m.localId === localId)!

describe('chatOpened', () => {
  it('creates and activates a chat', () => {
    const state = run([open('1')])
    expect(state.activeChatId).toBe('1')
    expect(state.order).toEqual(['1'])
    expect(state.chats['1']).toEqual({
      chatId: '1',
      title: '+1',
      phone: '1',
      messages: [],
      unread: 0,
      lastActivity: 1000,
    })
  })

  it('reuses an existing chat without losing messages', () => {
    const state = run([open('1'), incoming(), open('1', 5000, 'Другое имя')])
    expect(state.chats['1']!.messages).toHaveLength(1)
    expect(state.chats['1']!.title).toBe('+1')
  })

  it('replaces a placeholder title (the bare chatId) with a better one', () => {
    const state = run([incoming({ senderName: '1' }), open('1', 3000, '+7 999 123-45-67')])
    expect(state.chats['1']!.title).toBe('+7 999 123-45-67')
  })
})

describe('incomingText', () => {
  it('creates a chat for an unknown sender and counts it as unread', () => {
    const state = run([incoming()])
    expect(state.chats['1']).toMatchObject({ title: 'Вася', unread: 1, lastActivity: 2000 })
    expect(state.chats['1']!.messages[0]).toEqual({
      localId: 'in:in-1',
      idMessage: 'in-1',
      direction: 'in',
      text: 'Привет',
      timestamp: 2000,
    })
    expect(state.activeChatId).toBeNull()
  })

  it('does not count messages in the active chat as unread', () => {
    expect(run([open('1'), incoming()]).chats['1']!.unread).toBe(0)
  })

  it('ignores duplicates by idMessage', () => {
    const state = run([incoming(), incoming()])
    expect(state.chats['1']!.messages).toHaveLength(1)
    expect(state.chats['1']!.unread).toBe(1)
  })

  it('sorts a real backlog (older than the threshold) into the past', () => {
    const now = 10 * 60_000
    const state = run([
      open('1'),
      queued('L1', 'mine', now),
      incoming({ timestamp: now - BACKLOG_THRESHOLD_MS - 1 }),
    ])
    expect(state.chats['1']!.messages.map((m) => m.text)).toEqual(['Привет', 'mine'])
    expect(state.chats['1']!.lastActivity).toBe(now)
  })

  it('keeps a fresh reply after our message despite clock skew and second precision', () => {
    // Server clock is 30 s behind ours and truncates to seconds.
    const state = run([open('1'), queued('L1', 'mine', 60_400), incoming({ timestamp: 30_000 })])
    expect(state.chats['1']!.messages.map((m) => m.text)).toEqual(['mine', 'Привет'])
  })

  it('appends own messages even when the server clock is ahead', () => {
    const state = run([open('1'), incoming({ timestamp: 90_000 }), queued('L1', 'mine', 60_000)])
    expect(state.chats['1']!.messages.map((m) => m.text)).toEqual(['Привет', 'mine'])
  })

  it('moves the chat to the top of the list', () => {
    const state = run([open('1', 1000), open('2', 2000), incoming({ timestamp: 3000 })])
    expect(state.order).toEqual(['1', '2'])
  })
})

describe('chatSelected', () => {
  it('resets unread for the selected chat', () => {
    const state = run([incoming(), { type: 'chatSelected', chatId: '1' }])
    expect(state.activeChatId).toBe('1')
    expect(state.chats['1']!.unread).toBe(0)
  })

  it('can clear the selection', () => {
    expect(run([open('1'), { type: 'chatSelected', chatId: null }]).activeChatId).toBeNull()
  })
})

describe('outgoing messages', () => {
  it('queues as pending and becomes sent with idMessage', () => {
    let state = run([open('1'), queued()])
    expect(outMessage(state)).toMatchObject({ status: 'pending', direction: 'out', text: 'hi' })
    state = run([sent()], state)
    expect(outMessage(state)).toMatchObject({ status: 'sent', idMessage: 'M1' })
  })

  it('advances through delivered and read', () => {
    const state = run([
      open('1'),
      queued(),
      sent(),
      status('M1', 'delivered'),
      status('M1', 'read'),
    ])
    expect(outMessage(state).status).toBe('read')
  })

  it('never downgrades a status', () => {
    const state = run([
      open('1'),
      queued(),
      sent(),
      status('M1', 'read'),
      status('M1', 'delivered'),
    ])
    expect(outMessage(state).status).toBe('read')
  })

  it('ignores failed after delivery', () => {
    const state = run([
      open('1'),
      queued(),
      sent(),
      status('M1', 'delivered'),
      status('M1', 'failed'),
    ])
    expect(outMessage(state).status).toBe('delivered')
  })

  it('marks delivery failure with a reason', () => {
    const state = run([
      open('1'),
      queued(),
      sent(),
      {
        type: 'outgoingStatus',
        event: {
          type: 'outgoingStatus',
          chatId: '1',
          idMessage: 'M1',
          status: 'failed',
          description: 'нет аккаунта',
        },
      },
    ])
    expect(outMessage(state)).toMatchObject({ status: 'failed', error: 'нет аккаунта' })
  })

  it('buffers a status that arrives before the SendMessage response', () => {
    let state = run([open('1'), queued(), status('M1', 'delivered')])
    expect(state.pendingStatuses).toEqual([{ idMessage: 'M1', status: 'delivered' }])
    state = run([sent()], state)
    expect(outMessage(state).status).toBe('delivered')
    expect(state.pendingStatuses).toEqual([])
  })

  it('keeps the highest buffered status', () => {
    const state = run([open('1'), status('M1', 'read'), status('M1', 'delivered')])
    expect(state.pendingStatuses).toEqual([{ idMessage: 'M1', status: 'read' }])
  })

  it('caps the buffer, evicting the oldest statuses', () => {
    const actions = Array.from({ length: MAX_PENDING_STATUSES + 5 }, (_, i) =>
      status(String(i), 'read'),
    )
    const state = run(actions)
    expect(state.pendingStatuses).toHaveLength(MAX_PENDING_STATUSES)
    expect(state.pendingStatuses[0]!.idMessage).toBe('5')
    expect(state.pendingStatuses.at(-1)!.idMessage).toBe(String(MAX_PENDING_STATUSES + 4))
  })

  it('fails and retries', () => {
    let state = run([
      open('1'),
      queued(),
      { type: 'messageFailed', chatId: '1', localId: 'L1', error: 'сеть' },
    ])
    expect(outMessage(state)).toMatchObject({ status: 'failed', error: 'сеть' })
    state = run([{ type: 'messageRetry', chatId: '1', localId: 'L1' }], state)
    expect(outMessage(state).status).toBe('pending')
    expect(outMessage(state).error).toBeUndefined()
  })

  it('ignores actions for unknown chats or messages', () => {
    const state = run([open('1')])
    expect(run([sent('M9', 'nope')], state)).toEqual(state)
    expect(
      run([{ type: 'messageQueued', chatId: 'zzz', localId: 'x', text: 'x', now: 1 }], state),
    ).toEqual(state)
  })
})
