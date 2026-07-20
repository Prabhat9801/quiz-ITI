// Repairs JSON files that have raw (unescaped) control characters (newlines, tabs, etc.)
// embedded inside string literals — walks char-by-char tracking string boundaries and
// escapes any raw control char found inside a string.
import { readFile, writeFile } from 'node:fs/promises'

function repair(raw) {
  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    const code = raw.charCodeAt(i)
    if (inString) {
      if (escaped) {
        out += ch
        escaped = false
        continue
      }
      if (ch === '\\') {
        out += ch
        escaped = true
        continue
      }
      if (ch === '"') {
        out += ch
        inString = false
        continue
      }
      if (code < 0x20) {
        // raw control char inside a string -> escape it
        if (ch === '\n') out += '\\n'
        else if (ch === '\r') out += '\\r'
        else if (ch === '\t') out += '\\t'
        else out += '\\u' + code.toString(16).padStart(4, '0')
        continue
      }
      out += ch
    } else {
      if (ch === '"') {
        inString = true
      }
      out += ch
    }
  }
  return out
}

const files = process.argv.slice(2)
for (const f of files) {
  const raw = await readFile(f, 'utf-8')
  const fixed = repair(raw)
  try {
    const parsed = JSON.parse(fixed)
    await writeFile(f, JSON.stringify(parsed, null, 2), 'utf-8')
    console.log(`OK repaired: ${f} (${parsed.questions.length} questions)`)
  } catch (e) {
    console.log(`STILL BAD: ${f} -> ${e.message}`)
  }
}
