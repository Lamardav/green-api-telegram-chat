export type PhoneResult = { ok: true; digits: string } | { ok: false; error: string }

const ALLOWED = /^[\d\s()+\-.]*$/
const MIN_DIGITS = 10
const MAX_DIGITS = 15 // E.164 limit

/**
 * Turns user input into the digits-only form GREEN-API expects.
 * No country-specific rewriting (e.g. 8 → 7): Telegram is international and
 * guessing would corrupt valid foreign numbers.
 */
export function normalizePhone(input: string): PhoneResult {
  const value = input.trim()
  if (value === '') return { ok: false, error: 'Введите номер телефона' }
  if (!ALLOWED.test(value)) {
    return {
      ok: false,
      error: 'Номер может содержать только цифры, пробелы, скобки, дефисы и «+»',
    }
  }
  const digits = value.replace(/\D/g, '')
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) {
    return { ok: false, error: `Номер должен содержать от ${MIN_DIGITS} до ${MAX_DIGITS} цифр` }
  }
  return { ok: true, digits }
}

export function formatPhone(digits: string): string {
  const ru = /^7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(digits)
  if (ru) return `+7 ${ru[1]} ${ru[2]}-${ru[3]}-${ru[4]}`
  return `+${digits}`
}
