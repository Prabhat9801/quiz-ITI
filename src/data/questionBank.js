// Every topic file has exactly 30 questions (by construction of the question bank).
export const QUESTIONS_PER_TOPIC = 30

let manifestPromise = null
let allQuestionsPromise = null
const topicFileCache = new Map()

export function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch('/questions/manifest.json').then((r) => r.json())
  }
  return manifestPromise
}

export async function getUnits() {
  const manifest = await loadManifest()
  return manifest.units
}

export async function getUnitById(unitId) {
  const units = await getUnits()
  return units.find((u) => u.id === unitId) ?? null
}

/** Full pool of all 5,100 questions, each tagged with unitId/unitName/topicId/topicName. Cached after first fetch. */
export function loadAllQuestions() {
  if (!allQuestionsPromise) {
    allQuestionsPromise = fetch('/questions/all-questions.json').then((r) => r.json())
  }
  return allQuestionsPromise
}

/** Loads one topic's 30 questions, tagged with unit/topic metadata. Cached per file. */
export async function loadTopicQuestions(unit, topic) {
  const cacheKey = `${unit.folder}/${topic.file}`
  if (topicFileCache.has(cacheKey)) return topicFileCache.get(cacheKey)

  const data = await fetch(`/questions/${unit.folder}/${topic.file}`).then((r) => r.json())
  const tagged = data.questions.map((q) => ({
    ...q,
    unitId: unit.id,
    unitName: unit.name,
    topicId: topic.id,
    topicName: topic.name,
  }))
  topicFileCache.set(cacheKey, tagged)
  return tagged
}

/**
 * Loads and merges questions for a list of topic refs.
 * @param {Array<{unitId, unitName, folder, topicId, topicName, file}>} topicRefs
 */
export async function loadQuestionsForTopics(topicRefs) {
  const groups = await Promise.all(
    topicRefs.map((ref) =>
      loadTopicQuestions(
        { id: ref.unitId, name: ref.unitName, folder: ref.folder },
        { id: ref.topicId, name: ref.topicName, file: ref.file }
      )
    )
  )
  return groups.flat()
}

function shuffle(array) {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Picks `count` random questions from `pool` (or all of it, shuffled, if pool is smaller). */
export function sampleQuestions(pool, count) {
  return shuffle(pool).slice(0, Math.min(count, pool.length))
}

/** Returns a copy of the question with its options shuffled and correctIndex remapped. */
export function shuffleQuestionOptions(question) {
  const order = shuffle([0, 1, 2, 3])
  const options = order.map((i) => question.options[i])
  const correctIndex = order.indexOf(question.correctIndex)
  return { ...question, options, correctIndex }
}

/** Prepares a quiz-ready set: sample `count` questions, then shuffle each one's option order. */
export function prepareQuizQuestions(pool, count) {
  return sampleQuestions(pool, count).map(shuffleQuestionOptions)
}
