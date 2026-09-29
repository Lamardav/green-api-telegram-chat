import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Message } from '../../domain/types'
import { MessageBubble } from './MessageBubble'

const base: Message = {
  localId: 'L1',
  direction: 'out',
  text: 'Привет',
  timestamp: new Date(2026, 8, 30, 14, 7).getTime(),
  status: 'sent',
}

const renderBubble = (patch: Partial<Message> = {}, onRetry = vi.fn()) => {
  render(<MessageBubble message={{ ...base, ...patch }} groupStart groupEnd onRetry={onRetry} />)
  return onRetry
}

describe('MessageBubble', () => {
  it('shows text and time', () => {
    renderBubble()
    expect(screen.getByText('Привет')).toBeInTheDocument()
    expect(screen.getByText('14:07')).toBeInTheDocument()
  })

  it.each([
    ['pending', 'Отправляется'],
    ['sent', 'Отправлено'],
    ['delivered', 'Доставлено'],
    ['read', 'Прочитано'],
  ] as const)('labels the %s status', (status, label) => {
    renderBubble({ status })
    expect(screen.getByRole('img', { name: label })).toBeInTheDocument()
  })

  it('has no status on incoming messages', () => {
    renderBubble({ direction: 'in', status: undefined })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders text literally, never as HTML', () => {
    renderBubble({ text: '<img src=x onerror=alert(1)> **жирный**' })
    expect(screen.getByText('<img src=x onerror=alert(1)> **жирный**')).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })

  it('offers a retry for failed messages', async () => {
    const onRetry = renderBubble({ status: 'failed', error: 'Нет сети' })
    expect(screen.getByRole('img', { name: 'Ошибка отправки' })).toBeInTheDocument()
    expect(screen.getByText('Нет сети')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(onRetry).toHaveBeenCalledWith('L1')
  })
})
