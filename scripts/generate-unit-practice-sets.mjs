// Generates FIXED "Unit Practice Sets" — one set of questions per group of whole topics within a
// single Trade Unit, packed to ~100 questions per set (never splitting a topic across two sets).
// Unlike the global Practice Sets (1-30, sampled across the whole syllabus), these are unit-scoped:
// playing all of a unit's sets covers every question that exists for every topic in that unit, so
// the unit's syllabus never needs to be re-studied from the book.
//
// Each set is permanent/reproducible (deterministic — just reads whatever is currently in each
// topic file, no randomness) so it can be downloaded as a stable PDF worksheet like the global
// Practice Sets. Re-run this whenever a Trade Unit's topic files change (new questions added):
//   node scripts/generate-unit-practice-sets.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const questionsDir = path.join(__dirname, '..', 'public', 'questions')
const outDir = path.join(questionsDir, 'unit-practice-sets')

const SET_SIZE = 100

async function loadTopicPool(unit, topic) {
  const filePath = path.join(questionsDir, unit.folder, topic.file)
  const data = JSON.parse(await readFile(filePath, 'utf-8'))
  const questions = data.questions.map((q) => ({
    ...q,
    unitId: unit.id,
    unitName: unit.name,
    topicId: topic.id,
    topicName: topic.name,
  }))
  return { topicId: topic.id, topicName: topic.name, questions }
}

/**
 * Greedily packs whole topic pools into sets of at most SET_SIZE questions each. A topic is
 * never split across two sets (so every set's topic list stays clean/labelable) UNLESS a single
 * topic's pool itself exceeds SET_SIZE, in which case that one topic is split across consecutive
 * sets on its own (kept out of the way of other topics).
 */
function packIntoSets(topicPools) {
  const sets = []
  let current = { topics: [], questions: [] }

  function flush() {
    if (current.questions.length > 0) {
      sets.push(current)
      current = { topics: [], questions: [] }
    }
  }

  for (const pool of topicPools) {
    if (pool.questions.length > SET_SIZE) {
      flush()
      for (let i = 0; i < pool.questions.length; i += SET_SIZE) {
        sets.push({
          topics: [{ topicId: pool.topicId, topicName: pool.topicName }],
          questions: pool.questions.slice(i, i + SET_SIZE),
        })
      }
      continue
    }
    if (current.questions.length + pool.questions.length > SET_SIZE) flush()
    current.topics.push({ topicId: pool.topicId, topicName: pool.topicName })
    current.questions.push(...pool.questions)
  }
  flush()
  return sets
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(questionsDir, 'manifest.json'), 'utf-8'))
  const tradeUnits = manifest.units.filter((u) => u.subject === 'Trade')

  await mkdir(outDir, { recursive: true })

  const indexUnits = []

  for (const unit of tradeUnits) {
    const unitDir = path.join(outDir, unit.folder)
    await mkdir(unitDir, { recursive: true })

    const topicPools = []
    for (const topic of unit.topics) {
      topicPools.push(await loadTopicPool(unit, topic))
    }

    const sets = packIntoSets(topicPools)

    const setIndex = []
    for (let i = 0; i < sets.length; i++) {
      const setNumber = i + 1
      const fileName = `set-${String(setNumber).padStart(2, '0')}.json`
      const payload = {
        unitId: unit.id,
        unitName: unit.name,
        setNumber,
        topics: sets[i].topics,
        questions: sets[i].questions,
      }
      await writeFile(path.join(unitDir, fileName), JSON.stringify(payload), 'utf-8')
      setIndex.push({
        setNumber,
        file: fileName,
        questionCount: sets[i].questions.length,
        topics: sets[i].topics,
      })
    }

    const totalQuestions = topicPools.reduce((sum, p) => sum + p.questions.length, 0)
    indexUnits.push({
      unitId: unit.id,
      unitName: unit.name,
      folder: unit.folder,
      totalQuestions,
      totalSets: setIndex.length,
      sets: setIndex,
    })

    console.log(`${unit.id} (${unit.name}): ${totalQuestions} questions -> ${setIndex.length} sets`)
  }

  await writeFile(
    path.join(outDir, 'index.json'),
    JSON.stringify({ questionsPerSet: SET_SIZE, units: indexUnits }),
    'utf-8'
  )

  console.log(`\nGenerated Unit Practice Sets -> ${outDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
