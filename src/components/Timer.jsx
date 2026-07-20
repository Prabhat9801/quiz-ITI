function formatTime(totalSeconds) {
  const s = Math.max(0, totalSeconds)
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export default function Timer({ secondsLeft, expired }) {
  if (secondsLeft === null || secondsLeft === undefined) return null
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-sm font-semibold ${
        expired ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
      }`}
    >
      <span>⏱</span>
      <span>{formatTime(secondsLeft)}</span>
    </div>
  )
}
