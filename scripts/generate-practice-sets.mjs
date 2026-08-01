// Generates 30 FIXED practice sets (100 questions each) from public/questions/all-questions.json.
// Each set is permanent/reproducible (deterministic seeded shuffle) so it can be downloaded as a
// stable PDF worksheet — re-running this script regenerates the exact same 30 sets every time,
// as long as all-questions.json itself hasn't changed.
//
// Run whenever the question bank changes: `node scripts/generate-practice-sets.mjs`
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const questionsDir = path.join(__dirname, '..', 'public', 'questions')
const setsDir = path.join(questionsDir, 'practice-sets')

const TOTAL_SETS = 30
const QUESTIONS_PER_SET = 100
const SEED = 42 // fixed seed -> same 30 sets every time this script runs

// Deterministic PRNG (mulberry32) so the shuffle is reproducible across machines/runs.
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle(array, rng) {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

async function main() {
  const allQuestions = JSON.parse(
    await readFile(path.join(questionsDir, 'all-questions.json'), 'utf-8')
  )

  const needed = TOTAL_SETS * QUESTIONS_PER_SET
  if (allQuestions.length < needed) {
    throw new Error(
      `Pool has ${allQuestions.length} questions but ${needed} are needed for ${TOTAL_SETS} sets of ${QUESTIONS_PER_SET}.`
    )
  }

  const rng = mulberry32(SEED)
  const shuffled = seededShuffle(allQuestions, rng)

  await mkdir(setsDir, { recursive: true })

  const index = []
  for (let setNum = 1; setNum <= TOTAL_SETS; setNum++) {
    const start = (setNum - 1) * QUESTIONS_PER_SET
    const setQuestions = shuffled.slice(start, start + QUESTIONS_PER_SET)
    const fileName = `set-${String(setNum).padStart(2, '0')}.json`
    await writeFile(
      path.join(setsDir, fileName),
      JSON.stringify({ setNumber: setNum, questions: setQuestions }),
      'utf-8'
    )
    index.push({ setNumber: setNum, file: fileName, questionCount: setQuestions.length })
  }

  await writeFile(
    path.join(setsDir, 'index.json'),
    JSON.stringify({ totalSets: TOTAL_SETS, questionsPerSet: QUESTIONS_PER_SET, sets: index }),
    'utf-8'
  )

  console.log(`Generated ${TOTAL_SETS} fixed practice sets (${QUESTIONS_PER_SET} questions each) -> ${setsDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
