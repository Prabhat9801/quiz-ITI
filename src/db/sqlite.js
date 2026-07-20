import initSqlJs from 'sql.js'
import { get, set } from 'idb-keyval'

const DB_STORAGE_KEY = 'quizAppDb'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  mode TEXT NOT NULL,
  scope_label TEXT NOT NULL,
  is_exam INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  timer_seconds INTEGER,
  time_taken_seconds INTEGER NOT NULL,
  score INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  wrong_count INTEGER NOT NULL,
  unattempted_count INTEGER NOT NULL,
  questions_json TEXT NOT NULL,
  retry_config_json TEXT NOT NULL
);
`

let dbInstance = null
let dbPromise = null

async function persist() {
  if (!dbInstance) return
  const bytes = dbInstance.export()
  await set(DB_STORAGE_KEY, bytes)
}

async function createDb() {
  const SQL = await initSqlJs({
    locateFile: (file) => `/${file}`,
  })

  const savedBytes = await get(DB_STORAGE_KEY)
  const db = savedBytes ? new SQL.Database(savedBytes) : new SQL.Database()
  db.run(SCHEMA)
  return db
}

/** Resolves to the shared sql.js Database instance, initializing + loading it once. */
export function getDb() {
  if (!dbPromise) {
    dbPromise = createDb().then((db) => {
      dbInstance = db
      return db
    })
  }
  return dbPromise
}

export async function runAndPersist(sql, params) {
  const db = await getDb()
  db.run(sql, params)
  await persist()
}

export async function queryAll(sql, params) {
  const db = await getDb()
  const stmt = db.prepare(sql)
  if (params) stmt.bind(params)
  const rows = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

export async function queryOne(sql, params) {
  const rows = await queryAll(sql, params)
  return rows[0] ?? null
}
