import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadUnitPracticeSetsIndex, loadUnitPracticeSet } from '../data/questionBank'
import { downloadUnitPracticeSetWorksheetPdf, downloadUnitPracticeSetAnswersPdf } from '../pdf/practiceSetPdf'

export default function UnitPracticeSets() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(null)
  const [openUnitId, setOpenUnitId] = useState(null)
  const [openSet, setOpenSet] = useState(null)
  const [timerEnabled, setTimerEnabled] = useState(true)
  const [timerMinutes, setTimerMinutes] = useState('90')
  const [pdfBusy, setPdfBusy] = useState(null)

  useEffect(() => {
    loadUnitPracticeSetsIndex().then(setIndex)
  }, [])

  if (!index) {
    return <p className="text-slate-600">Load ho raha hai…</p>
  }

  const openUnit = index.units.find((u) => u.unitId === openUnitId) ?? null
  const openSetInfo = openUnit?.sets.find((s) => s.setNumber === openSet) ?? null

  function selectUnit(unitId) {
    setOpenUnitId((prev) => (prev === unitId ? null : unitId))
    setOpenSet(null)
  }

  async function handleDownload(variant) {
    if (!openUnit || !openSet) return
    const key = `${openUnit.unitId}-${openSet}-${variant}`
    setPdfBusy(key)
    try {
      const data = await loadUnitPracticeSet(openUnit.folder, openSet)
      const label = `${openUnit.unitName} - Set ${openSet}`
      if (variant === 'worksheet') {
        await downloadUnitPracticeSetWorksheetPdf(label, data.questions)
      } else {
        await downloadUnitPracticeSetAnswersPdf(label, data.questions)
      }
    } finally {
      setPdfBusy(null)
    }
  }

  function handleStart() {
    if (!openUnit || !openSetInfo) return
    const minutes = Math.max(1, Number(timerMinutes) || 1)
    navigate('/quiz', {
      state: {
        mode: 'unitpracticeset',
        unitFolder: openUnit.folder,
        unitSetNumber: openSet,
        topicRefs: [],
        questionCount: openSetInfo.questionCount,
        timerSeconds: timerEnabled ? minutes * 60 : null,
        scopeLabel: `${openUnit.unitName} - Set ${openSet}`,
        isExam: true,
      },
    })
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Unit Practice Sets</h1>
      <p className="text-sm text-slate-600 mb-4">
        Har Unit ke apne fixed sets hain — us Unit ke topics milkar jab ~100 questions ban jaate
        hain, tabhi ek naya set bana diya jaata hai. Har set ke saath yeh bhi likha hai ki usme
        kaunse topics cover ho rahe hain, taaki preparation track karna aasaan rahe. Exam-style —
        feedback sirf Submit ke baad milega.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4">
        {index.units.map((u) => (
          <button
            key={u.unitId}
            type="button"
            onClick={() => selectUnit(u.unitId)}
            className={`rounded-lg border p-2.5 sm:p-3 text-left transition ${
              openUnitId === u.unitId
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'
            }`}
          >
            <div className="text-sm font-semibold">{u.unitName}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {u.totalSets} sets &middot; {u.totalQuestions} questions
            </div>
          </button>
        ))}
      </div>

      {openUnit && (
        <div className="space-y-2 mb-5">
          {openUnit.sets.map((s) => (
            <button
              key={s.setNumber}
              type="button"
              onClick={() => setOpenSet((prev) => (prev === s.setNumber ? null : s.setNumber))}
              className={`w-full rounded-lg border p-3 text-left transition ${
                openSet === s.setNumber
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 bg-white hover:border-indigo-300'
              }`}
            >
              <div className="font-semibold text-slate-900 text-sm sm:text-base">
                Set {s.setNumber} &middot; {s.questionCount} questions
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {s.topics.map((t) => t.topicName).join(' + ')}
              </div>
            </button>
          ))}
        </div>
      )}

      {openSetInfo && (
        <div className="max-w-sm rounded-lg border border-slate-200 bg-white p-4 space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              {openUnit.unitName} — Set {openSet}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {openSetInfo.questionCount} questions &middot; {openSetInfo.topics.map((t) => t.topicName).join(' + ')}
            </p>
          </div>

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
            onClick={handleStart}
            className="w-full rounded-lg bg-indigo-600 py-2.5 font-semibold text-white transition hover:bg-indigo-700"
          >
            Set {openSet} Shuru Karo
          </button>

          <div className="border-t border-slate-200 pt-3 space-y-2">
            <p className="text-xs font-medium text-slate-500">PDF Download</p>
            <button
              type="button"
              onClick={() => handleDownload('worksheet')}
              disabled={pdfBusy === `${openUnit.unitId}-${openSet}-worksheet`}
              className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 disabled:opacity-50"
            >
              {pdfBusy === `${openUnit.unitId}-${openSet}-worksheet` ? 'PDF ban raha hai…' : '📄 Worksheet PDF (sirf questions)'}
            </button>
            <button
              type="button"
              onClick={() => handleDownload('answers')}
              disabled={pdfBusy === `${openUnit.unitId}-${openSet}-answers`}
              className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 disabled:opacity-50"
            >
              {pdfBusy === `${openUnit.unitId}-${openSet}-answers` ? 'PDF ban raha hai…' : '📄 Answer Key PDF (jawab + explanation)'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
