import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAttemptById } from '../db/historyService'

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}m ${s}s`
}

export default function Review() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    getAttemptById(id).then((row) => {
      if (cancelled) return
      if (!row) setNotFound(true)
      else setAttempt(row)
    })
    return () => { cancelled = true }
  }, [id])

  function handleRetry() {
    if (!attempt) return
    navigate('/quiz', { state: attempt.retryConfig })
  }

  if (notFound) {
    return (
      <div>
        <p className="text-slate-600 mb-3">Ye attempt nahi mila.</p>
        <button onClick={() => navigate('/history')} className="text-indigo-700 font-medium">History par jao</button>
      </div>
    )
  }

  if (!attempt) return <p className="text-slate-600">Load ho raha hai…</p>

  const pct = attempt.score
  const scoreColor = pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="max-w-2xl">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 mb-6">
        <div className="text-sm text-slate-500 mb-1">{attempt.scope_label}</div>
        <div className="flex flex-wrap items-baseline gap-2 sm:gap-3 mb-3">
          <span className={`text-2xl sm:text-3xl font-bold ${scoreColor}`}>{pct}%</span>
          <span className="text-sm sm:text-base text-slate-600">
            {attempt.correct_count} sahi · {attempt.wrong_count} galat · {attempt.unattempted_count} chhoote
          </span>
        </div>
        <div className="text-sm text-slate-500">
          {attempt.question_count} questions &middot; {formatDuration(attempt.time_taken_seconds)} me complete
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 sm:py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            🔁 Retry (naye random questions)
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg border border-slate-300 px-4 py-2.5 sm:py-2 text-sm font-medium"
          >
            Home
          </button>
        </div>
      </div>

      <h2 className="text-base sm:text-lg font-semibold mb-3">Question-by-question review</h2>
      <div className="space-y-4">
        {attempt.questions.map((q, i) => {
          const isCorrect = q.userAnswer === q.correctIndex
          const isUnattempted = q.userAnswer === null || q.userAnswer === undefined
          return (
            <div key={q.id ?? i} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="quiz-text font-medium text-slate-900">
                  {i + 1}. {q.question}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isUnattempted
                      ? 'bg-slate-100 text-slate-500'
                      : isCorrect
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {isUnattempted ? 'Chhoota' : isCorrect ? 'Sahi' : 'Galat'}
                </span>
              </div>

              {(q.unitName || q.topicName) && (
                <div className="mb-2 text-xs text-slate-400">
                  {q.unitName}{q.topicName ? ` · ${q.topicName}` : ''}
                </div>
              )}

              <div className="space-y-1.5 mb-3">
                {q.options.map((opt, oi) => {
                  let cls = 'rounded-lg border p-2 text-sm quiz-text '
                  if (oi === q.correctIndex) cls += 'border-green-500 bg-green-50 text-green-900'
                  else if (oi === q.userAnswer) cls += 'border-red-500 bg-red-50 text-red-900'
                  else cls += 'border-slate-200 bg-slate-50 text-slate-500'
                  return (
                    <div key={oi} className={cls}>
                      {opt}
                    </div>
                  )
                })}
              </div>

              <div className="rounded-lg bg-indigo-50 p-3">
                <p className="quiz-text text-sm text-indigo-900">{q.explanation}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
