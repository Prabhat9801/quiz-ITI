import { jsPDF } from 'jspdf'

// IMPORTANT: all question/option/explanation text is Devanagari Hindi with embedded English
// technical terms. jsPDF's built-in fonts (and even a registered custom Devanagari TTF via
// addFont) do NOT do proper Unicode text shaping — Devanagari needs conjunct-consonant ligatures
// (क्ष, त्र, ज्ञ) and matra reordering that jsPDF's per-glyph rendering pipeline can't produce
// correctly. The browser's own canvas text renderer DOES shape Devanagari correctly (it uses the
// OS/browser text stack), so each page is drawn to an offscreen <canvas> first, then that canvas
// is embedded into the PDF as a raster image. This keeps the app fully client-side (no server,
// no separate font-shaping service) while producing correct output.

const DPI_SCALE = 2 // render canvas at 2x for crisp text in the final PDF
const PAGE_WIDTH_MM = 210 // A4
const PAGE_HEIGHT_MM = 297
const MARGIN_MM = 14
const MM_TO_PX = 96 / 25.4 // CSS px per mm at 96dpi baseline (scaled again by DPI_SCALE)

const FONT_STACK = "'Noto Sans Devanagari', 'Nirmala UI', 'Mangal', system-ui, sans-serif"
const OPTION_LABELS = ['A', 'B', 'C', 'D']

/** Ensures the self-hosted Devanagari font (registered via @font-face in index.css) is fully
 * loaded before we draw to canvas — otherwise the browser may fall back to a font that can't
 * shape Devanagari conjuncts, silently producing garbled PDF text. */
async function ensureFontReady(bodyFontPx, titleFontPx) {
  await Promise.all([
    document.fonts.load(`${bodyFontPx}px "Noto Sans Devanagari"`),
    document.fonts.load(`bold ${bodyFontPx}px "Noto Sans Devanagari"`),
    document.fonts.load(`bold ${titleFontPx}px "Noto Sans Devanagari"`),
  ])
  await document.fonts.ready
}

function mmToPx(mm) {
  return Math.round(mm * MM_TO_PX * DPI_SCALE)
}

/** Wraps `text` to fit within `maxWidthPx` on the given canvas context, returning an array of lines. */
function wrapText(ctx, text, maxWidthPx) {
  const words = text.split(/\s+/)
  const lines = []
  let current = ''
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word
    if (ctx.measureText(trial).width > maxWidthPx && current) {
      lines.push(current)
      current = word
    } else {
      current = trial
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Renders a set of "blocks" (each block = array of {text, bold, indent, gapAfter}) into a
 * paginated jsPDF document, using an offscreen canvas per page for correct Devanagari shaping.
 * Returns the finished jsPDF doc.
 */
async function renderBlocksToPdf(blocks, { title, subtitle }) {
  const pageWpx = mmToPx(PAGE_WIDTH_MM)
  const pageHpx = mmToPx(PAGE_HEIGHT_MM)
  const marginPx = mmToPx(MARGIN_MM)
  const contentWidthPx = pageWpx - marginPx * 2
  const bodyFontPx = mmToPx(4.2)
  const titleFontPx = mmToPx(6.5)
  const lineHeightPx = Math.round(bodyFontPx * 1.55)

  await ensureFontReady(bodyFontPx, titleFontPx)

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let pageIndex = 0

  function newCanvas() {
    const canvas = document.createElement('canvas')
    canvas.width = pageWpx
    canvas.height = pageHpx
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, pageWpx, pageHpx)
    ctx.fillStyle = '#111111'
    ctx.textBaseline = 'top'
    return { canvas, ctx }
  }

  function flushPage(canvas) {
    const imgData = canvas.toDataURL('image/jpeg', 0.92)
    if (pageIndex > 0) doc.addPage()
    doc.addImage(imgData, 'JPEG', 0, 0, PAGE_WIDTH_MM, PAGE_HEIGHT_MM)
    pageIndex++
  }

  let { canvas, ctx } = newCanvas()
  let y = marginPx

  function ensureSpace(neededPx) {
    if (y + neededPx > pageHpx - marginPx) {
      flushPage(canvas)
      ;({ canvas, ctx } = newCanvas())
      y = marginPx
    }
  }

  // Header on first page
  ctx.font = `bold ${titleFontPx}px ${FONT_STACK}`
  ctx.fillText(title, marginPx, y)
  y += titleFontPx * 1.4
  if (subtitle) {
    ctx.font = `${bodyFontPx}px ${FONT_STACK}`
    ctx.fillStyle = '#555555'
    ctx.fillText(subtitle, marginPx, y)
    ctx.fillStyle = '#111111'
    y += bodyFontPx * 1.8
  }

  for (const block of blocks) {
    // Measure whole block height first so we can page-break before starting it.
    const measured = []
    let blockHeight = 0
    for (const line of block) {
      ctx.font = `${line.bold ? 'bold ' : ''}${bodyFontPx}px ${FONT_STACK}`
      const indentPx = mmToPx(line.indent ?? 0)
      const wrapped = wrapText(ctx, line.text, contentWidthPx - indentPx)
      measured.push({ ...line, wrapped, indentPx })
      blockHeight += wrapped.length * lineHeightPx
      blockHeight += mmToPx(line.gapAfter ?? 0)
    }

    ensureSpace(blockHeight)

    for (const line of measured) {
      ctx.font = `${line.bold ? 'bold ' : ''}${bodyFontPx}px ${FONT_STACK}`
      for (const wline of line.wrapped) {
        ctx.fillText(wline, marginPx + line.indentPx, y)
        y += lineHeightPx
      }
      y += mmToPx(line.gapAfter ?? 0)
    }
  }

  flushPage(canvas)
  return doc
}

function questionBlocks(questions, { withAnswers }) {
  const blocks = []
  questions.forEach((q, idx) => {
    const lines = [{ text: `${idx + 1}. ${q.question}`, bold: true, gapAfter: 1 }]
    q.options.forEach((opt, oi) => {
      const marker = withAnswers && oi === q.correctIndex ? ' ✓' : ''
      lines.push({ text: `${OPTION_LABELS[oi]}. ${opt}${marker}`, indent: 6 })
    })
    if (withAnswers && q.explanation) {
      lines.push({ text: `Explanation: ${q.explanation}`, indent: 3, gapAfter: 4 })
    } else {
      lines[lines.length - 1].gapAfter = 4
    }
    blocks.push(lines)
  })
  return blocks
}

/** Downloads a blank worksheet PDF (questions + options only, no answers) for a Practice Set. */
export async function downloadPracticeSetWorksheetPdf(setNumber, questions) {
  const doc = await renderBlocksToPdf(questionBlocks(questions, { withAnswers: false }), {
    title: `Practice Set ${setNumber}`,
    subtitle: `${questions.length} Questions`,
  })
  doc.save(`practice-set-${String(setNumber).padStart(2, '0')}-worksheet.pdf`)
}

/** Downloads the full PDF (questions + options + correct answer marked + explanations) for a Practice Set. */
export async function downloadPracticeSetAnswersPdf(setNumber, questions) {
  const doc = await renderBlocksToPdf(questionBlocks(questions, { withAnswers: true }), {
    title: `Practice Set ${setNumber}`,
    subtitle: `${questions.length} Questions · Answer Key & Explanations`,
  })
  doc.save(`practice-set-${String(setNumber).padStart(2, '0')}-with-answers.pdf`)
}

function safeFileName(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/** Downloads a blank worksheet PDF (questions + options only, no answers) for a Unit Practice Set. */
export async function downloadUnitPracticeSetWorksheetPdf(label, questions) {
  const doc = await renderBlocksToPdf(questionBlocks(questions, { withAnswers: false }), {
    title: label,
    subtitle: `${questions.length} Questions`,
  })
  doc.save(`${safeFileName(label) || 'unit-practice-set'}-worksheet.pdf`)
}

/** Downloads the full PDF (questions + options + correct answer marked + explanations) for a Unit Practice Set. */
export async function downloadUnitPracticeSetAnswersPdf(label, questions) {
  const doc = await renderBlocksToPdf(questionBlocks(questions, { withAnswers: true }), {
    title: label,
    subtitle: `${questions.length} Questions · Answer Key & Explanations`,
  })
  doc.save(`${safeFileName(label) || 'unit-practice-set'}-with-answers.pdf`)
}

/** Downloads a PDF of a completed attempt review (question + user's answer + correct answer + explanation). */
export async function downloadAttemptReviewPdf(scopeLabel, questions) {
  const blocks = []
  questions.forEach((q, idx) => {
    const isUnattempted = q.userAnswer === null || q.userAnswer === undefined
    const isCorrect = q.userAnswer === q.correctIndex
    const status = isUnattempted ? 'Not attempted' : isCorrect ? 'Correct' : 'Wrong'
    const lines = [{ text: `${idx + 1}. ${q.question}`, bold: true, gapAfter: 1 }]
    q.options.forEach((opt, oi) => {
      let marker = ''
      if (oi === q.correctIndex) marker = ' ✓ (correct)'
      else if (oi === q.userAnswer) marker = ' ✗ (your answer)'
      lines.push({ text: `${OPTION_LABELS[oi]}. ${opt}${marker}`, indent: 6 })
    })
    lines.push({ text: `Result: ${status}`, indent: 3, bold: true })
    if (q.explanation) {
      lines.push({ text: `Explanation: ${q.explanation}`, indent: 3, gapAfter: 4 })
    } else {
      lines[lines.length - 1].gapAfter = 4
    }
    blocks.push(lines)
  })

  const doc = await renderBlocksToPdf(blocks, {
    title: scopeLabel,
    subtitle: `${questions.length} Questions · Review`,
  })
  const safeName = scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  doc.save(`${safeName || 'attempt-review'}.pdf`)
}
