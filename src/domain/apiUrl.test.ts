import { describe, expect, it } from 'vitest'
import { deriveApiUrl, isValidIdInstance, normalizeApiUrl } from './apiUrl'

describe('deriveApiUrl', () => {
  it('uses the first four digits of idInstance as the host', () => {
    expect(deriveApiUrl('4100123456')).toBe('https://4100.api.green-api.com')
  })

  it('ignores surrounding whitespace', () => {
    expect(deriveApiUrl(' 4100123456 ')).toBe('https://4100.api.green-api.com')
  })
})

describe('normalizeApiUrl', () => {
  it('trims and removes trailing slashes', () => {
    expect(normalizeApiUrl(' https://4100.api.green-api.com/ ')).toBe(
      'https://4100.api.green-api.com',
    )
  })

  it('rejects non-http urls and garbage', () => {
    expect(normalizeApiUrl('ftp://example.com')).toBeNull()
    expect(normalizeApiUrl('not a url')).toBeNull()
    expect(normalizeApiUrl('')).toBeNull()
  })
})

describe('isValidIdInstance', () => {
  it('accepts digit strings of plausible length', () => {
    expect(isValidIdInstance('4100123456')).toBe(true)
  })

  it('rejects everything else', () => {
    expect(isValidIdInstance('')).toBe(false)
    expect(isValidIdInstance('41001a3456')).toBe(false)
    expect(isValidIdInstance('123')).toBe(false)
  })
})
