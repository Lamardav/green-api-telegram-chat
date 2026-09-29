import { describe, expect, it } from 'vitest'
import { formatDayLabel, formatListTime, formatTime, isSameDay } from './time'

// Local-time constructors keep these tests independent of the machine's time zone.
const now = new Date(2026, 8, 30, 15, 0).getTime()
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m, d, h, min).getTime()

describe('time formatting', () => {
  it('formats a clock time', () => {
    expect(formatTime(at(2026, 8, 30, 9, 5))).toBe('09:05')
  })

  it('formats chat list times relative to today', () => {
    expect(formatListTime(at(2026, 8, 30, 9, 5), now)).toBe('09:05')
    expect(formatListTime(at(2026, 8, 29, 23, 59), now)).toBe('вчера')
    expect(formatListTime(at(2026, 8, 1), now)).toBe('01.09')
    expect(formatListTime(at(2025, 11, 31), now)).toBe('31.12.25')
  })

  it('formats day separators', () => {
    expect(formatDayLabel(at(2026, 8, 30, 0, 1), now)).toBe('Сегодня')
    expect(formatDayLabel(at(2026, 8, 29), now)).toBe('Вчера')
    expect(formatDayLabel(at(2026, 8, 5), now)).toBe('5 сентября')
    expect(formatDayLabel(at(2025, 0, 2), now)).toBe('2 января 2025 г.')
  })

  it('compares calendar days', () => {
    expect(isSameDay(at(2026, 8, 30, 0, 0), at(2026, 8, 30, 23, 59))).toBe(true)
    expect(isSameDay(at(2026, 8, 30), at(2026, 8, 29))).toBe(false)
  })
})
