import { Link } from 'react-router-dom'

const MODES = [
  {
    to: '/setup/topic',
    title: 'Topic-wise Quiz',
    desc: 'Ek Unit, ek Topic — sirf usi ke questions',
    emoji: '🎯',
  },
  {
    to: '/setup/unit',
    title: 'Unit-wise Quiz',
    desc: 'Pura Unit choose karo, saare topics milakar',
    emoji: '📘',
  },
  {
    to: '/setup/multiunit',
    title: 'Multi-Unit Quiz',
    desc: 'Kai Units select karo ek saath',
    emoji: '🔀',
  },
  {
    to: '/setup/custom',
    title: 'Custom Practice',
    desc: 'Apni marzi ke topics chuno, poore syllabus tak',
    emoji: '⚙️',
  },
  {
    to: '/practice-sets',
    title: 'Practice Sets (1–30)',
    desc: 'Poore syllabus se 100 random questions, exam-style',
    emoji: '📝',
  },
  {
    to: '/history',
    title: 'History',
    desc: 'Pichle attempts ka review',
    emoji: '📊',
  },
]

export default function Home() {
  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
        Electronic Mechanic / Radio &amp; TV — Quiz System
      </h1>
      <p className="text-sm sm:text-base text-slate-600 mb-5 sm:mb-6">
        170 topics, 5,100 questions — Hindi me, technical terms English me.
      </p>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
        {MODES.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md active:bg-slate-50"
          >
            <div className="text-2xl sm:text-3xl mb-2">{m.emoji}</div>
            <div className="text-base sm:text-lg font-semibold text-slate-900">{m.title}</div>
            <div className="text-sm text-slate-600 mt-1">{m.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
