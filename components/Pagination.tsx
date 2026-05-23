'use client'

interface Props {
  min: number
  max: number
  current: number
  sDigit?: number
  onClick?: (page: number) => void
}

export default function Pagination({ min, max, current, sDigit = 1, onClick }: Props) {
  const arrSize = sDigit * 2 + 1
  const showFirst = current - sDigit <= min
  const showLast = current + sDigit >= max

  let pages: number[]
  if (showFirst) {
    pages = Array.from({ length: arrSize }, (_, i) => min + i).filter(v => v <= max)
  } else if (showLast) {
    pages = Array.from({ length: arrSize }, (_, i) => max - i).sort((a, b) => a - b)
  } else {
    pages = Array.from({ length: arrSize }, (_, i) => current - sDigit + i)
  }

  const btn = (label: string | number, page: number, active = false) => (
    <button key={`${label}`} onClick={() => onClick?.(page)}
      className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
      style={{
        background: active ? 'var(--accent)' : 'var(--bg-raised)',
        color: active ? '#fff' : 'var(--text-muted)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      }}>
      {label}
    </button>
  )

  const dot = (key: string) => (
    <span key={key} className="w-8 h-8 flex items-end justify-center pb-1 text-xs" style={{ color: 'var(--text-muted)' }}>···</span>
  )

  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      {current !== min && btn('‹', current - 1)}
      {!showFirst && <>{btn(min, min)}{dot('d1')}</>}
      {pages.map(p => btn(p, p, p === current))}
      {!showLast && <>{dot('d2')}{btn(max, max)}</>}
      {current !== max && btn('›', current + 1)}
    </div>
  )
}
