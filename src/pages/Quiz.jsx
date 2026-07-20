import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loadAllQuestions, loadQuestionsForTopics, prepareQuizQuestions } from '../data/questionBank'
import { saveAttempt } from '../db/historyService'
import Timer from '../components/Timer.jsx'

export default function Quiz() {
  const { state } = useLocation()
  const navigate = useNavigate()

  const [questions, setQuestions] = useState(null)
  const [answers, setAnswers] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(state?.timerSeconds ?? null)
  const [timeUp, setTimeUp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    if (!state) return
    let cancelled = false
    async function load() {
      const pool =
        state.mode === 'practiceset'
          ? await loadAllQuestions()
          : await loadQuestionsForTopics(state.topicRefs)
      if (cancelled) return
      const prepared = prepareQuizQuestions(pool, state.questionCount)
      setQuestions(prepared)
      setAnswers(new Array(prepared.length).fill(null))
      startTimeRef.current = Date.now()
    }
    load()
    return () => { cancelled = true }
  }, [state])

  useEffect(() => {
    if (timeRemaining === null) return
    if (timeRemaining <= 0) {
      setTimeUp(true)
      return
    }
    const t = setTimeout(() => setTimeRemaining((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [timeRemaining])

  if (!state) {
    return (
      <div>
        <p className="text-slate-600 mb-3">Quiz config nahi mila.</p>
        <button onClick={() => navigate('/')} className="text-indigo-700 font-medium">Home par jao</button>
      </div>
    )
  }

  if (!questions) {
    return <p className="text-slate-600">Questions load ho rahe hain…</p>
  }

  if (questions.length === 0) {
    return (
      <div>
        <p className="text-slate-600 mb-3">Is selection ke liye koi questions nahi mile.</p>
        <button onClick={() => navigate('/')} className="text-indigo-700 font-medium">Home par jao</button>
      </div>
    )
  }

  const { isExam } = state
  const current = questions[currentIndex]
  const currentAnswer = answers[currentIndex]
  const isLocked = !isExam && currentAnswer !== null && currentAnswer !== undefined

  function selectOption(optionIndex) {
    if (!isExam && currentAnswer !== null && currentAnswer !== undefined) return
    setAnswers((prev) => {
      const next = [...prev]
      next[currentIndex] = optionIndex
      return next
    })
  }

  function optionClasses(optionIndex) {
    const base = 'w-full text-left rounded-lg border p-3 quiz-text transition'
    if (isExam) {
      return `${base} ${
        currentAnswer === optionIndex
          ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
          : 'border-slate-200 bg-white hover:border-indigo-300'
      }`
    }
    // learning mode
    if (!isLocked) {
      return `${base} border-slate-200 bg-white hover:border-indigo-300 cursor-pointer`
    }
    if (optionIndex === current.correctIndex) {
      return `${base} border-green-500 bg-green-50 text-green-900`
    }
    if (optionIndex === currentAnswer) {
      return `${base} border-red-500 bg-red-50 text-red-900`
    }
    return `${base} border-slate-200 bg-slate-50 text-slate-400`
  }

  async function handleSubmit() {
    setSubmitting(true)
    const timeTakenSeconds = state.timerSeconds
      ? state.timerSeconds - (timeRemaining ?? 0)
      : Math.round((Date.now() - startTimeRef.current) / 1000)

    const snapshot = questions.map((q, i) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      unitName: q.unitName,
      topicName: q.topicName,
      userAnswer: answers[i] ?? null,
    }))

    const retryConfig = {
      mode: state.mode,
      topicRefs: state.topicRefs,
      questionCount: state.questionCount,
      timerSeconds: state.timerSeconds,
      scopeLabel: state.scopeLabel,
      isExam: state.isExam,
    }

    const id = await saveAttempt({
      mode: state.mode,
      scopeLabel: state.scopeLabel,
      isExam: state.isExam,
      timerSeconds: state.timerSeconds,
      timeTakenSeconds,
      questions: snapshot,
      retryConfig,
    })
    navigate(`/review/${id}`, { replace: true })
  }

  const answeredCount = answers.filter((a) => a !== null && a !== undefined).length

  return (
    <div className="max-w-2xl pb-24">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm text-slate-500">{state.scopeLabel}</div>
          <div className="text-sm font-medium text-slate-700">
            Q {currentIndex + 1} / {questions.length} &middot; {answeredCount} answered
          </div>
        </div>
        <Timer secondsLeft={timeRemaining} expired={timeUp} />
      </div>

      {timeUp && (
        <div className="mb-4 rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-700">
          ⏰ Time khatam ho gaya hai! Ab Submit kar do.
        </div>
      )}

      {/* question navigator */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {questions.map((_, i) => {
          const answered = answers[i] !== null && answers[i] !== undefined
          const isCurrent = i === currentIndex
          return (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`h-7 w-7 rounded text-xs font-semibold ${
                isCurrent
                  ? 'bg-indigo-600 text-white'
                  : answered
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {(current.unitName || current.topicName) && (
          <div className="mb-2 text-xs text-slate-400">
            {current.unitName}{current.topicName ? ` · ${current.topicName}` : ''}
          </div>
        )}
        <p className="quiz-text font-medium text-slate-900 mb-4">{current.question}</p>

        <div className="space-y-2">
          {current.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectOption(i)}
              disabled={isLocked}
              className={optionClasses(i)}
            >
              {opt}
            </button>
          ))}
        </div>

        {!isExam && isLocked && (
          <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-700 mb-1">
              {currentAnswer === current.correctIndex ? '✅ Sahi jawab!' : '❌ Galat jawab'}
            </p>
            <p className="quiz-text text-sm text-slate-700">{current.explanation}</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            ← Previous
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white"
            >
              Next →
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="ml-auto rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isExam ? 'Submit Quiz' : 'Quiz Khatam Karo'}
          </button>
        </div>
      </div>
    </div>
  )
}
