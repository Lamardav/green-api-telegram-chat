export type Obj = Record<string, unknown>

/** Plain JSON object (not null, not an array). */
export const isObject = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export const isString = (v: unknown): v is string => typeof v === 'string'

export const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** The value if it is a string, otherwise an empty string. */
export const str = (v: unknown): string => (typeof v === 'string' ? v : '')
