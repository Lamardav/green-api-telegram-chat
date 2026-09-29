import { useId, type SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = (props: IconProps) => ({
  'aria-hidden': true,
  focusable: false,
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})

/** Neutral app mark (not the MAX logo). */
export function AppMark(props: IconProps) {
  const gradientId = useId()
  return (
    <svg aria-hidden focusable={false} viewBox="0 0 32 32" {...props}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0070EB" />
          <stop offset="1" stopColor="#17A8E5" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
      <path
        d="M9 10.5A2.5 2.5 0 0 1 11.5 8h9A2.5 2.5 0 0 1 23 10.5v7a2.5 2.5 0 0 1-2.5 2.5H15l-4.2 3.4c-.5.4-1.3 0-1.3-.6V20A2.5 2.5 0 0 1 9 17.5z"
        fill="#fff"
      />
    </svg>
  )
}

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const SendIcon = (p: IconProps) => (
  <svg {...base({ fill: 'currentColor', stroke: 'none', ...p })}>
    <path d="M4.4 19.6 21 12 4.4 4.4a.6.6 0 0 0-.84.7L5.7 11a1 1 0 0 1 0 2l-2.14 5.9a.6.6 0 0 0 .84.7Z" />
  </svg>
)

export const BackIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

export const LogoutIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
  </svg>
)

export const PersonIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 19.5c1.2-3.2 3.8-4.8 7-4.8s5.8 1.6 7 4.8" />
  </svg>
)

export const ClockIcon = (p: IconProps) => (
  <svg {...base({ width: 16, height: 16, viewBox: '0 0 16 16', strokeWidth: 1.4, ...p })}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 5v3.2l2 1.3" />
  </svg>
)

export const CheckIcon = (p: IconProps) => (
  <svg {...base({ width: 16, height: 16, viewBox: '0 0 16 16', strokeWidth: 1.6, ...p })}>
    <path d="M3 8.5l3 3 7-7" />
  </svg>
)

export const DoubleCheckIcon = (p: IconProps) => (
  <svg {...base({ width: 20, height: 16, viewBox: '0 0 20 16', strokeWidth: 1.6, ...p })}>
    <path d="M1.5 8.5l3 3 7-7M8.5 11.5l.5.5 7-7" />
  </svg>
)

export const AlertIcon = (p: IconProps) => (
  <svg {...base({ width: 16, height: 16, viewBox: '0 0 16 16', strokeWidth: 1.6, ...p })}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.8v3.6M8 11h.01" />
  </svg>
)

export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
