/**
 * GREEN-API hosts instances on `https://{first 4 digits of idInstance}.api.green-api.com`.
 * This is observed behaviour, not a documented contract, so the UI lets the user override it.
 */
export function deriveApiUrl(idInstance: string): string {
  return `https://${idInstance.trim().slice(0, 4)}.api.green-api.com`
}

export function normalizeApiUrl(raw: string): string | null {
  const value = raw.trim()
  if (value === '') return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  return value.replace(/\/+$/, '')
}

export function isValidIdInstance(id: string): boolean {
  return /^\d{6,20}$/.test(id.trim())
}
