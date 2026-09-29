import { describe, expect, it } from 'vitest'
import { formatPhone, normalizePhone } from './phone'

describe('normalizePhone', () => {
  it('strips formatting characters', () => {
    expect(normalizePhone('+7 (999) 123-45-67')).toEqual({ ok: true, digits: '79991234567' })
  })

  it('does not rewrite a leading 8', () => {
    expect(normalizePhone('89991234567')).toEqual({ ok: true, digits: '89991234567' })
  })

  it('accepts non-Russian numbers', () => {
    expect(normalizePhone('+44 20 7946 0958')).toEqual({ ok: true, digits: '442079460958' })
  })

  it('rejects an empty value', () => {
    expect(normalizePhone('   ')).toEqual({ ok: false, error: 'Введите номер телефона' })
  })

  it('rejects numbers that are too short or too long', () => {
    const error = 'Номер должен содержать от 10 до 15 цифр'
    expect(normalizePhone('12345')).toEqual({ ok: false, error })
    expect(normalizePhone('1234567890123456')).toEqual({ ok: false, error })
  })

  it('rejects letters instead of silently dropping them', () => {
    expect(normalizePhone('+7 999 abc 45 67')).toEqual({
      ok: false,
      error: 'Номер может содержать только цифры, пробелы, скобки, дефисы и «+»',
    })
  })
})

describe('formatPhone', () => {
  it('groups Russian numbers', () => {
    expect(formatPhone('79991234567')).toBe('+7 999 123-45-67')
  })

  it('prefixes other numbers with plus only', () => {
    expect(formatPhone('442079460958')).toBe('+442079460958')
  })
})
