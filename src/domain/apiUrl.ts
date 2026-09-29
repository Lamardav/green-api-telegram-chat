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
  // The token travels in the URL path, so plain HTTP is accepted only for a local proxy.
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null
  return value.replace(/\/+$/, '')
}

export function isValidIdInstance(id: string): boolean {
  return /^\d{6,20}$/.test(id.trim())
}
