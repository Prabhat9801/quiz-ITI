import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getUnits, QUESTIONS_PER_TOPIC } from '../data/questionBank'

const MODE_TITLES = {
  topic: 'Topic-wise Quiz',
  unit: 'Unit-wise Quiz',
  multiunit: 'Multi-Unit Quiz',
  custom: 'Custom Practice',
}

export default function Setup() {
  const { mode } = useParams()
  const navigate = useNavigate()
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)

  const [topicUnitId, setTopicUnitId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [selectedUnitIds, setSelectedUnitIds] = useState(new Set())
  const [selectedTopicKeys, setSelectedTopicKeys] = useState(new Set())
  const [expandedUnits, setExpandedUnits] = useState(new Set())

  const [questionCount, setQuestionCount] = useState('10')
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState('15')

  useEffect(() => {
    getUnits().then((u) => {
      setUnits(u)
      setLoading(false)
    })
  }, [])

  const topicsOfSelectedUnit = units.find((u) => u.id === topicUnitId)?.topics ?? []

  const maxAvailable = useMemo(() => {
    if (mode === 'topic') return topicId ? QUESTIONS_PER_TOPIC : 0
    if (mode === 'unit') {
      const u = units.find((x) => x.id === unitId)
      return (u?.topics.length ?? 0) * QUESTIONS_PER_TOPIC
    }
    if (mode === 'multiunit') {
      let count = 0
      for (const u of units) if (selectedUnitIds.has(u.id)) count += u.topics.length
      return count * QUESTIONS_PER_TOPIC
    }
    if (mode === 'custom') return selectedTopicKeys.size * QUESTIONS_PER_TOPIC
    return 0
  }, [mode, topicId, unitId, units, selectedUnitIds, selectedTopicKeys])

  // Only clamp DOWN when the max shrinks below what's currently typed - never fight the user mid-typing.
  useEffect(() => {
    if (maxAvailable === 0) return
    setQuestionCount((prev) => {
      const n = Number(prev)
      if (!n) return prev
      return n > maxAvailable ? String(maxAvailable) : prev
    })
  }, [maxAvailable])

  function toggleUnit(id) {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleUnitExpanded(id) {
    setExpandedUnits((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function isUnitFullySelected(unit) {
    return unit.topics.every((t) => selectedTopicKeys.has(`${unit.id}::${t.id}`))
  }
  function isUnitPartiallySelected(unit) {
    return unit.topics.some((t) => selectedTopicKeys.has(`${unit.id}::${t.id}`)) && !isUnitFullySelected(unit)
  }

  function toggleWholeUnitCustom(unit) {
    setSelectedTopicKeys((prev) => {
      const next = new Set(prev)
      const fully = isUnitFullySelected(unit)
      for (const t of unit.topics) {
        const key = `${unit.id}::${t.id}`
        fully ? next.delete(key) : next.add(key)
      }
      return next
    })
  }

  function toggleTopicCustom(unit, topic) {
    const key = `${unit.id}::${topic.id}`
    setSelectedTopicKeys((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function selectWholeSyllabus() {
    const all = new Set()
    for (const u of units) for (const t of u.topics) all.add(`${u.id}::${t.id}`)
    setSelectedTopicKeys(all)
  }

  function buildTopicRefs() {
    const toRef = (u, t) => ({
      unitId: u.id, unitName: u.name, folder: u.folder, topicId: t.id, topicName: t.name, file: t.file,
    })
    if (mode === 'topic') {
      const u = units.find((x) => x.id === topicUnitId)
      const t = u?.topics.find((x) => x.id === topicId)
      return u && t ? [toRef(u, t)] : []
    }
    if (mode === 'unit') {
      const u = units.find((x) => x.id === unitId)
      return u ? u.topics.map((t) => toRef(u, t)) : []
    }
    if (mode === 'multiunit') {
      const refs = []
      for (const u of units) {
        if (!selectedUnitIds.has(u.id)) continue
        for (const t of u.topics) refs.push(toRef(u, t))
      }
      return refs
    }
    if (mode === 'custom') {
      const refs = []
      for (const u of units) {
        for (const t of u.topics) {
          if (selectedTopicKeys.has(`${u.id}::${t.id}`)) refs.push(toRef(u, t))
        }
      }
      return refs
    }
    return []
  }

  function buildScopeLabel() {
    if (mode === 'topic') {
      const u = units.find((x) => x.id === topicUnitId)
      const t = u?.topics.find((x) => x.id === topicId)
      return t ? `${u.name} → ${t.name}` : ''
    }
    if (mode === 'unit') {
      const u = units.find((x) => x.id === unitId)
      return u ? `Unit: ${u.name}` : ''
    }
    if (mode === 'multiunit') {
      const names = units.filter((u) => selectedUnitIds.has(u.id)).map((u) => u.name)
      return `Multi-Unit: ${names.join(', ')}`
    }
    if (mode === 'custom') {
      const unitIdsInvolved = new Set([...selectedTopicKeys].map((k) => k.split('::')[0]))
      return `Custom (${selectedTopicKeys.size} topics across ${unitIdsInvolved.size} units)`
    }
    return ''
  }

  const numericQuestionCount = Math.max(1, Math.min(maxAvailable || 1, Number(questionCount) || 0))
  const numericTimerMinutes = Math.max(1, Number(timerMinutes) || 1)
  const canStart = maxAvailable > 0 && numericQuestionCount > 0

  function handleStart() {
    navigate('/quiz', {
      state: {
        mode,
        topicRefs: buildTopicRefs(),
        questionCount: numericQuestionCount,
        timerSeconds: timerEnabled ? numericTimerMinutes * 60 : null,
        scopeLabel: buildScopeLabel(),
        isExam: false,
      },
    })
  }

  if (loading) return <p className="text-slate-600">Load ho raha hai…</p>

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-4">{MODE_TITLES[mode] ?? 'Setup'}</h1>

      {mode === 'topic' && (
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
            <select
              className="w-full rounded-lg border border-slate-300 p-2.5 text-base"
              value={topicUnitId}
              onChange={(e) => { setTopicUnitId(e.target.value); setTopicId('') }}
            >
              <option value="">-- Unit chuno --</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          {topicUnitId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Topic</label>
              <select
                className="w-full rounded-lg border border-slate-300 p-2.5 text-base"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
              >
                <option value="">-- Topic chuno --</option>
                {topicsOfSelectedUnit.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {mode === 'unit' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
          <select
            className="w-full rounded-lg border border-slate-300 p-2.5 text-base"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          >
            <option value="">-- Unit chuno --</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.topics.length} topics)</option>
            ))}
          </select>
        </div>
      )}

      {mode === 'multiunit' && (
        <div className="mb-6 space-y-1 max-h-96 overflow-y-auto rounded-lg border border-slate-200 p-3 bg-white">
          {units.map((u) => (
            <label key={u.id} className="flex items-center gap-2.5 py-2 sm:py-1.5 cursor-pointer active:bg-slate-50 rounded-md -mx-1 px-1">
              <input
                type="checkbox"
                checked={selectedUnitIds.has(u.id)}
                onChange={() => toggleUnit(u.id)}
                className="h-5 w-5 sm:h-4 sm:w-4 shrink-0"
              />
              <span className="text-sm">
                {u.name} <span className="text-slate-400">({u.topics.length} topics)</span>
              </span>
            </label>
          ))}
        </div>
      )}

      {mode === 'custom' && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-2">
            <button type="button" onClick={selectWholeSyllabus} className="text-xs rounded-md bg-indigo-50 text-indigo-700 px-2.5 py-1.5 font-medium">
              Poora Syllabus Select Karo
            </button>
            <button type="button" onClick={() => setSelectedTopicKeys(new Set())} className="text-xs rounded-md bg-slate-100 text-slate-700 px-2.5 py-1.5 font-medium">
              Clear All
            </button>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto rounded-lg border border-slate-200 p-3 bg-white">
            {units.map((u) => (
              <div key={u.id} className="border-b border-slate-100 last:border-0 pb-1 mb-1">
                <div className="flex items-center gap-2.5 py-2 sm:py-1.5">
                  <input
                    type="checkbox"
                    checked={isUnitFullySelected(u)}
                    ref={(el) => { if (el) el.indeterminate = isUnitPartiallySelected(u) }}
                    onChange={() => toggleWholeUnitCustom(u)}
                    className="h-5 w-5 sm:h-4 sm:w-4 shrink-0"
                  />
                  <button type="button" onClick={() => toggleUnitExpanded(u.id)} className="text-sm font-medium text-left flex-1 py-1 -my-1">
                    {expandedUnits.has(u.id) ? '▾' : '▸'} {u.name}
                  </button>
                </div>
                {expandedUnits.has(u.id) && (
                  <div className="pl-5 sm:pl-6 space-y-0.5">
                    {u.topics.map((t) => (
                      <label key={t.id} className="flex items-center gap-2.5 py-1.5 sm:py-1 cursor-pointer active:bg-slate-50 rounded-md">
                        <input
                          type="checkbox"
                          checked={selectedTopicKeys.has(`${u.id}::${t.id}`)}
                          onChange={() => toggleTopicCustom(u, t)}
                          className="h-4 w-4 shrink-0"
                        />
                        <span className="text-xs sm:text-sm text-slate-700">{t.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Number of Questions {maxAvailable > 0 && <span className="text-slate-400">(max {maxAvailable})</span>}
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={maxAvailable || undefined}
            value={questionCount}
            onChange={(e) => setQuestionCount(e.target.value)}
            onBlur={() => setQuestionCount((prev) => {
              const n = Number(prev) || 1
              const clamped = maxAvailable > 0 ? Math.min(n, maxAvailable) : n
              return String(Math.max(1, clamped))
            })}
            className="w-full sm:w-32 rounded-lg border border-slate-300 p-2.5 text-base"
          />
          {maxAvailable === 0 && (
            <p className="mt-1 text-xs text-slate-400">Pehle upar selection karo, max yahan dikhega.</p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 mb-2">
            <input type="checkbox" checked={timerEnabled} onChange={(e) => setTimerEnabled(e.target.checked)} className="h-4 w-4" />
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
                className="w-full sm:w-32 rounded-lg border border-slate-300 p-2.5 text-base"
              />
              <span className="text-sm text-slate-500">minutes</span>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={!canStart}
          onClick={handleStart}
          className="w-full rounded-lg bg-indigo-600 py-2.5 font-semibold text-white transition hover:bg-indigo-700 disabled:bg-slate-300"
        >
          Quiz Shuru Karo
        </button>
      </div>
    </div>
  )
}
