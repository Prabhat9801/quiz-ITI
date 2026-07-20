import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const TOTAL_SETS = 30
const SET_QUESTION_COUNT = 100

export default function PracticeSets() {
  const navigate = useNavigate()
  const [openSet, setOpenSet] = useState(null)
  const [timerEnabled, setTimerEnabled] = useState(true)
  const [timerMinutes, setTimerMinutes] = useState('90')

  function handleStart(setNumber) {
    const minutes = Math.max(1, Number(timerMinutes) || 1)
    navigate('/quiz', {
      state: {
        mode: 'practiceset',
        topicRefs: [],
        questionCount: SET_QUESTION_COUNT,
        timerSeconds: timerEnabled ? minutes * 60 : null,
        scopeLabel: `Practice Set ${setNumber}`,
        isExam: true,
      },
    })
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Practice Sets (1–30)</h1>
      <p className="text-sm text-slate-600 mb-4">
        Har set me poore syllabus (5,100 questions) se {SET_QUESTION_COUNT} random questions — exam-style,
        feedback sirf submit karne ke baad milega.
      </p>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 sm:gap-3">
        {Array.from({ length: TOTAL_SETS }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setOpenSet(openSet === n ? null : n)}
            className={`rounded-lg border p-2.5 sm:p-3 text-center text-sm sm:text-base font-semibold transition ${
              openSet === n
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'
            }`}
          >
            Set {n}
          </button>
        ))}
      </div>

      {openSet && (
        <div className="mt-5 max-w-sm rounded-lg border border-slate-200 bg-white p-4 space-y-4">
          <h2 className="font-semibold text-slate-900">Practice Set {openSet} — {SET_QUESTION_COUNT} questions</h2>

          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={timerEnabled}
                onChange={(e) => setTimerEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium text-slate-700">Timer set karo</span>
            </label>
            {timerEnabled && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={timerMinutes}
                  onChange={(e) => setTimerMinutes(e.target.value)}
                  onBlur={() => setTimerMinutes(String(Math.max(1, Number(timerMinutes) || 1)))}
                  className="w-full sm:w-28 rounded-lg border border-slate-300 p-2.5 text-base"
                />
                <span className="text-sm text-slate-500">minutes</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleStart(openSet)}
            className="w-full rounded-lg bg-indigo-600 py-2.5 font-semibold text-white transition hover:bg-indigo-700"
          >
            Set {openSet} Shuru Karo
          </button>
        </div>
      )}
    </div>
  )
}
