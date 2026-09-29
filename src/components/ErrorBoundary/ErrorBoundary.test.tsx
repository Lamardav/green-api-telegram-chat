import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Broken(): never {
  throw new Error('render failed')
}

describe('ErrorBoundary', () => {
  it('shows a recovery screen instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Что-то пошло не так')
    expect(screen.getByRole('button', { name: 'Перезагрузить' })).toBeInTheDocument()
  })

  it('renders children when nothing fails', () => {
    render(
      <ErrorBoundary>
        <p>всё хорошо</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('всё хорошо')).toBeInTheDocument()
  })
})
