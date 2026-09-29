export function DemoBadge() {
  return (
    <div
      role="note"
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 10,
        padding: '4px 10px',
        borderRadius: 10,
        background: '#17181c',
        color: '#fff',
        fontSize: 12,
        lineHeight: '16px',
        pointerEvents: 'none',
        opacity: 0.8,
      }}
    >
      Демо-режим
    </div>
  )
}
