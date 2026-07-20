// Rebuilds public/questions/all-questions.json by merging manifest.json + every topic file.
// Run this whenever a topic JSON file is added/changed: `node scripts/merge-questions.mjs`
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const questionsDir = path.join(__dirname, '..', 'public', 'questions')

async function main() {
  const manifestRaw = await readFile(path.join(questionsDir, 'manifest.json'), 'utf-8')
  const manifest = JSON.parse(manifestRaw)

  const allQuestions = []
  let topicCount = 0

  for (const unit of manifest.units) {
    for (const topic of unit.topics) {
      const filePath = path.join(questionsDir, unit.folder, topic.file)
      const raw = await readFile(filePath, 'utf-8')
      const data = JSON.parse(raw)
      topicCount++
      for (const q of data.questions) {
        allQuestions.push({
          ...q,
          unitId: unit.id,
          unitName: unit.name,
          topicId: topic.id,
          topicName: topic.name,
        })
      }
    }
  }

  const outPath = path.join(questionsDir, 'all-questions.json')
  await writeFile(outPath, JSON.stringify(allQuestions), 'utf-8')
  console.log(`Merged ${topicCount} topics -> ${allQuestions.length} questions -> ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
