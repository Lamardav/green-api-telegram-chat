import { describe, expect, it } from 'vitest'
import { AVATAR_GRADIENTS, avatarGradient, initials } from './avatar'

describe('avatarGradient', () => {
  it('is deterministic and picks from the palette', () => {
    expect(avatarGradient('10000001')).toBe(avatarGradient('10000001'))
    expect(AVATAR_GRADIENTS).toContain(avatarGradient('10000001'))
  })

  it('spreads different ids across the palette', () => {
    const used = new Set(Array.from({ length: 50 }, (_, i) => avatarGradient(String(10000000 + i))))
    expect(used.size).toBeGreaterThan(1)
  })
})

describe('initials', () => {
  it('takes the first letters of up to two words', () => {
    expect(initials('Иван Петров')).toBe('ИП')
    expect(initials('василиса')).toBe('В')
    expect(initials('  Anna   Maria Lee ')).toBe('AM')
  })

  it('returns an empty string when there are no letters', () => {
    expect(initials('+7 999 123-45-67')).toBe('')
    expect(initials('')).toBe('')
  })
})
