// Copies every sql.js wasm build variant into public/, since Vite's build-vs-dev
// environment resolution can pick either the "browser" export (sql-wasm-browser.wasm)
// or the default one (sql-wasm.wasm) - keeping both present avoids a 404 either way.
import { readdir, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist')
const destDir = path.join(__dirname, '..', 'public')

async function main() {
  const files = await readdir(srcDir)
  const wasmFiles = files.filter((f) => f.endsWith('.wasm') && !f.includes('debug'))
  for (const f of wasmFiles) {
    await copyFile(path.join(srcDir, f), path.join(destDir, f))
    console.log(`Copied ${f} -> public/`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
