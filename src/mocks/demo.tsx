import { createFakeGreenApi, FAKE_ID_INSTANCE, FAKE_PHONE, FAKE_TOKEN } from './fakeGreenApi'
import { formatPhone } from '../domain/phone'

/** Wiring for `npm run dev:mock`: a simulated instance that replies to every message. */
export function setupDemo() {
  const fake = createFakeGreenApi({ autoReply: true, replyDelayMs: 1500, settingsReady: false })
  // Handy for poking the simulator from DevTools, e.g. __demo.pushIncoming('10000001', 'Hi').
  Object.assign(window, { __demo: fake })

  const loginHint = (
    <div
      style={{
        marginTop: 16,
        padding: '10px 12px',
        borderRadius: 12,
        background: '#fff4d6',
        fontSize: 13,
        lineHeight: '18px',
        textAlign: 'left',
      }}
    >
      <strong>Демо-режим:</strong> запросы не уходят в GREEN-API.
      <br />
      idInstance <code>{FAKE_ID_INSTANCE}</code>, apiTokenInstance <code>{FAKE_TOKEN}</code>, номер
      получателя <code>{formatPhone(FAKE_PHONE)}</code>
    </div>
  )

  return { fetchImpl: fake.fetch, loginHint }
}
