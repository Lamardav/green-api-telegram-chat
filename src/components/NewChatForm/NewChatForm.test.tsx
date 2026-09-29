import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { OpenChatResult } from '../../state/chats'
import { NewChatForm } from './NewChatForm'

function setup(result: OpenChatResult = { ok: true }) {
  const onSubmit = vi.fn(async () => result)
  const onClose = vi.fn()
  render(<NewChatForm onSubmit={onSubmit} onClose={onClose} />)
  return {
    onSubmit,
    onClose,
    user: userEvent.setup(),
    input: screen.getByLabelText('Номер телефона получателя'),
  }
}

describe('NewChatForm', () => {
  it('focuses the phone field and needs input before submitting', () => {
    const { input } = setup()
    expect(input).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Создать чат' })).toBeDisabled()
  })

  it('submits the raw number and closes on success', async () => {
    const { user, input, onSubmit, onClose } = setup()
    await user.type(input, '+7 999 000-00-01{Enter}')
    expect(onSubmit).toHaveBeenCalledWith('+7 999 000-00-01')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the error and stays open on failure', async () => {
    const { user, input, onClose } = setup({ ok: false, error: 'Номер не найден' })
    await user.type(input, '79990009999')
    await user.click(screen.getByRole('button', { name: 'Создать чат' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Номер не найден')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(onClose).not.toHaveBeenCalled()

    await user.type(input, '1')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('closes on Escape and on cancel', async () => {
    const { user, onClose } = setup()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
