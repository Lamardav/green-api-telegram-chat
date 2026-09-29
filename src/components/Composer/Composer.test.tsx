import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Composer } from './Composer'

function setup() {
  const onSend = vi.fn()
  render(<Composer onSend={onSend} />)
  return {
    onSend,
    user: userEvent.setup(),
    input: screen.getByLabelText('Сообщение'),
    button: screen.getByRole('button', { name: 'Отправить' }),
  }
}

describe('Composer', () => {
  it('sends on Enter and clears the field', async () => {
    const { user, input, onSend } = setup()
    expect(input).toHaveFocus()
    await user.type(input, 'Привет{Enter}')
    expect(onSend).toHaveBeenCalledWith('Привет')
    expect(input).toHaveValue('')
  })

  it('inserts a newline on Shift+Enter', async () => {
    const { user, input, onSend } = setup()
    await user.type(input, 'раз{Shift>}{Enter}{/Shift}два')
    expect(input).toHaveValue('раз\nдва')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not send while an IME composition is active', () => {
    const { input, onSend } = setup()
    fireEvent.change(input, { target: { value: 'にほん' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('keeps the send button disabled for blank input', async () => {
    const { user, input, button, onSend } = setup()
    expect(button).toBeDisabled()
    await user.type(input, '   {Enter}')
    expect(button).toBeDisabled()
    expect(onSend).not.toHaveBeenCalled()
  })

  it('sends with the button', async () => {
    const { user, input, button, onSend } = setup()
    await user.type(input, 'кнопкой')
    await user.click(button)
    expect(onSend).toHaveBeenCalledWith('кнопкой')
  })

  it('limits length and shows a counter near the limit', () => {
    const { input } = setup()
    expect(input).toHaveAttribute('maxLength', '4096')
    fireEvent.change(input, { target: { value: 'x'.repeat(4000) } })
    expect(screen.getByText('4000/4096')).toBeInTheDocument()
  })
})
