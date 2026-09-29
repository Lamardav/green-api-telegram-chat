const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' })
const shortDateYear = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})
const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const dayMonthYear = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const startOfDay = (ts: number) => {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const isSameYear = (a: number, b: number) => new Date(a).getFullYear() === new Date(b).getFullYear()

/** Days between the calendar dates of `ts` and `now` (0 = same day). */
function dayDiff(ts: number, now: number): number {
  return Math.round((startOfDay(now) - startOfDay(ts)) / 86_400_000)
}

export function formatTime(ts: number): string {
  return timeFormat.format(ts)
}

/** Chat list: time today, "вчера", otherwise a short date. */
export function formatListTime(ts: number, now = Date.now()): string {
  const diff = dayDiff(ts, now)
  if (diff === 0) return formatTime(ts)
  if (diff === 1) return 'вчера'
  return (isSameYear(ts, now) ? shortDate : shortDateYear).format(ts)
}

/** Date separator inside a conversation. */
export function formatDayLabel(ts: number, now = Date.now()): string {
  const diff = dayDiff(ts, now)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Вчера'
  return (isSameYear(ts, now) ? dayMonth : dayMonthYear).format(ts)
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b)
}
