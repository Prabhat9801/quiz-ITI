import { runAndPersist, queryAll, queryOne } from './sqlite'

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Saves a completed attempt.
 * @param {object} attempt
 * @param {string} attempt.mode - 'topic' | 'unit' | 'multiunit' | 'custom' | 'practiceset'
 * @param {string} attempt.scopeLabel - human-readable label, e.g. "Unit 3 - Sensors, Transducers"
 * @param {boolean} attempt.isExam - true for Practice Sets (exam mode), false for learning modes
 * @param {number} attempt.timerSeconds - null if no timer was set
 * @param {number} attempt.timeTakenSeconds
 * @param {Array} attempt.questions - full snapshot: [{id, question, options, correctIndex, userAnswer, explanation, unitName, topicName}]
 * @param {object} attempt.retryConfig - enough info to relaunch the same scope with fresh random questions
 * @returns {Promise<string>} the new attempt's id
 */
export async function saveAttempt(attempt) {
  const id = newId()
  const correctCount = attempt.questions.filter((q) => q.userAnswer === q.correctIndex).length
  const unattemptedCount = attempt.questions.filter((q) => q.userAnswer === null || q.userAnswer === undefined).length
  const wrongCount = attempt.questions.length - correctCount - unattemptedCount
  const score = Math.round((correctCount / attempt.questions.length) * 100)

  await runAndPersist(
    `INSERT INTO attempts
      (id, timestamp, mode, scope_label, is_exam, question_count, timer_seconds, time_taken_seconds,
       score, correct_count, wrong_count, unattempted_count, questions_json, retry_config_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      Date.now(),
      attempt.mode,
      attempt.scopeLabel,
      attempt.isExam ? 1 : 0,
      attempt.questions.length,
      attempt.timerSeconds ?? null,
      attempt.timeTakenSeconds,
      score,
      correctCount,
      wrongCount,
      unattemptedCount,
      JSON.stringify(attempt.questions),
      JSON.stringify(attempt.retryConfig),
    ]
  )
  return id
}

/** Lightweight list for the History screen (excludes the heavy question snapshot). */
export async function getAllAttempts() {
  const rows = await queryAll(
    `SELECT id, timestamp, mode, scope_label, is_exam, question_count, timer_seconds,
            time_taken_seconds, score, correct_count, wrong_count, unattempted_count, retry_config_json
     FROM attempts ORDER BY timestamp DESC`
  )
  return rows.map((r) => ({ ...r, retryConfig: JSON.parse(r.retry_config_json) }))
}

/** Full row including the question snapshot, for the Review screen. */
export async function getAttemptById(id) {
  const row = await queryOne(`SELECT * FROM attempts WHERE id = ?`, [id])
  if (!row) return null
  return {
    ...row,
    questions: JSON.parse(row.questions_json),
    retryConfig: JSON.parse(row.retry_config_json),
  }
}
