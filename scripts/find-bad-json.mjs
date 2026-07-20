import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const questionsDir = path.join(__dirname, '..', 'public', 'questions')

async function main() {
  const manifest = JSON.parse(await readFile(path.join(questionsDir, 'manifest.json'), 'utf-8'))
  for (const unit of manifest.units) {
    for (const topic of unit.topics) {
      const filePath = path.join(questionsDir, unit.folder, topic.file)
      const raw = await readFile(filePath, 'utf-8')
      try {
        JSON.parse(raw)
      } catch (e) {
        console.log(`BAD: ${unit.folder}/${topic.file} -> ${e.message}`)
      }
    }
  }
  console.log('done scanning')
}
main()
