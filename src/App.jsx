import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Setup from './pages/Setup.jsx'
import PracticeSets from './pages/PracticeSets.jsx'
import Quiz from './pages/Quiz.jsx'
import Review from './pages/Review.jsx'
import History from './pages/History.jsx'

function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold text-indigo-700">
            Electronic Mechanic Quiz
          </Link>
          <Link
            to="/history"
            className="text-sm font-medium text-slate-600 hover:text-indigo-700"
          >
            History
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup/:mode" element={<Setup />} />
          <Route path="/practice-sets" element={<PracticeSets />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/review/:id" element={<Review />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
