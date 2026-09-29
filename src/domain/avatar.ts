/** Placeholder avatar gradients used by web.max.ru (orchid, tangerine, malachite, dark-sky, lilac). */
export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #FA82BA, #E74AA6)',
  'linear-gradient(135deg, #FFB381, #E5782D)',
  'linear-gradient(135deg, #1BD6E3, #27A5C8)',
  'linear-gradient(135deg, #79BCFF, #4289ED)',
  'linear-gradient(135deg, #9B90FE, #6746EC)',
] as const

export function avatarGradient(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]!
}

export function initials(title: string): string {
  return title
    .split(/\s+/)
    .map((word) => /\p{L}/u.exec(word)?.[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
