# Quiz App — Project Guide for Claude Code

This file is auto-loaded by Claude Code whenever work happens in this directory. Read `docs/PROJECT_HISTORY.md` too for the full narrative of how this project came to be and every decision made along the way.

## What this is

A quiz/practice-test system for **ITI Electronic Mechanic / Mechanic Radio & TV** trade syllabus (see `docs/syllabus.txt`). Fully client-side (no backend, no login) — built to deploy as a static site on Render.

## Tech stack

- **React 19 + Vite** — UI and build tooling
- **react-router-dom** — client-side routing between screens
- **sql.js** (SQLite compiled to WebAssembly) — stores quiz history/attempts. The `.wasm` file lives at `public/sql-wasm.wasm`.
- **idb-keyval** — persists the serialized SQLite database into the browser's IndexedDB so history survives page reloads.
- **Tailwind CSS v4** (`@tailwindcss/vite` plugin) — styling.
- **jspdf** — generates Practice Set / attempt-review PDFs entirely client-side (see "Practice Set PDF export" below).

No server, no database service, no user accounts. Everything (question bank + history) lives in the browser/static files.

## Data: the question bank

- `public/questions/manifest.json` — master index: 19 subject/unit groups (16 trade units + Mathematics + Physics + Chemistry), each with a list of topics (`{id, name, file}`).
- `public/questions/<UnitFolder>/<topic>.json` — one file per topic, each containing **exactly 30 questions**. Schema per question:
  ```json
  { "id": "...", "question": "...", "options": ["...", "...", "...", "..."], "correctIndex": 0, "explanation": "..." }
  ```
- `public/questions/all-questions.json` — a generated, flattened merge of every topic file (all questions tagged with unit/topic metadata), used for whole-syllabus / Practice Set sampling so the app doesn't need 170 separate fetches. **Regenerate this whenever a topic file changes** by running:
  ```
  node scripts/merge-questions.mjs
  ```
- Total: **170 topics × 30 questions = 5,100 questions**.
- `docs/GENERATION_SPEC.md` — the exact rules used to generate every question (format, difficulty, language). If more questions are ever added by hand or by an agent, follow this spec.

### CRITICAL language rule

Every question, option, and explanation is written in **Devanagari Hindi**, with **technical terms kept in English** embedded inside the Hindi sentence (e.g. Transistor, forward bias, op-amp, IGBT, RTD, selling price). Do NOT translate technical terms into Hindi — the target user learned them only in English. Chemistry element/compound names stay in English with standard symbols/formulas (Sodium (Na), H2SO4). This is a hard requirement carried over from the design conversation — see `docs/PROJECT_HISTORY.md` for why.

## Finalized product spec (build against this)

**Modes:** Topic-wise, Unit-wise, Multi-Unit, Custom (topic-level tree picker), Practice Sets (1–30), Unit Practice Sets, History.

**Two behavior modes:**
- **Learning Mode** (Topic / Unit / Multi-Unit / Custom): pick an option → immediate correct/wrong feedback + explanation shown → answer locks. Previous/Next both navigate freely.
- **Exam Mode** (Practice Sets 1–30): no feedback until final Submit. Previous/Next can freely change answers before submitting. Full result + review only appears after Submit.

**Timer:** user sets it (or "No Timer") in every mode, including Practice Sets. When it hits zero: **show a warning only** — do NOT auto-submit. User must submit manually.

**Practice Sets (1–30):** **fixed, permanent content** — each set is a pre-generated, unchanging list of exactly 100 questions (see `public/questions/practice-sets/set-01.json` … `set-30.json`, built by `scripts/generate-practice-sets.mjs` with a fixed seed so regenerating is reproducible). Playing/retrying a set always uses the same 100 questions (only their on-screen order and each question's option order are reshuffled per-play — the question *set* itself never changes). This was a deliberate reversal of the original "always-random" design, made specifically so each set could be exported as a stable, downloadable PDF worksheet (see below). The 30 sets together cover 3,000 of the 5,100 questions (non-overlapping); the rest of the pool is still used by Topic/Unit/Multi-Unit/Custom modes.

**Practice Set PDF export:** every set has two downloadable PDFs, generated entirely client-side from `public/questions/practice-sets/set-NN.json` (`src/pdf/practiceSetPdf.js`, using `jspdf`): a blank worksheet (questions + options only) and an answer-key version (questions + correct answer marked + explanations). A **completed attempt** (any mode, from the History/Review screen) can also be downloaded as a PDF of that specific attempt's question-by-question review.

**Unit Practice Sets (WIP — see `docs/PROJECT_HISTORY.md` 2026-09-22 entry for full context, being built on branch `feature/unit-practice-sets`):** a separate mode, scoped to the **16 Trade Units only** (not Math/Physics/Chemistry). The goal is exhaustive per-topic coverage — each topic's question file is grown well beyond the base 30 until practicing it fully substitutes for re-reading that topic's theory. Each unit's full (expanded) topic pool is packed into **fixed sets of ~100 questions, grouped by whole topics** (a topic is never split across two sets) via `scripts/generate-unit-practice-sets.mjs`, which reads `public/questions/<UnitFolder>/*.json` directly and writes `public/questions/unit-practice-sets/<UnitFolder>/set-NN.json` + `unit-practice-sets/index.json`. Unlike the global Practice Sets, **set count and set size are flexible per unit** (a thin unit like Cell Phones gets 2 sets, a dense one like Microcontroller gets 7-8) — there is no fixed "N sets per unit" rule. Every set is labeled with the topic(s) it contains, shown in the UI (`src/pages/UnitPracticeSets.jsx`) so preparation stays organized. Sets are fixed/permanent content (same convention as global Practice Sets) with PDF export via the generic `downloadUnitPracticeSetWorksheetPdf`/`downloadUnitPracticeSetAnswersPdf` functions in `src/pdf/practiceSetPdf.js`. Loaded in `Quiz.jsx` via `state.mode === 'unitpracticeset'`. **As of this writing, only Unit1's topics have been expanded** — the remaining 15 Trade Units still need their topic files grown (same per-topic-subagent generation pattern) before `generate-unit-practice-sets.mjs` is re-run for them.

**Why PDFs render via canvas, not jsPDF's text API:** all content is Devanagari Hindi. jsPDF's built-in fonts (and even a custom TTF registered via `addFont`) don't do real Unicode text shaping — Devanagari needs conjunct-consonant ligatures (क्ष, त्र, ज्ञ) and matra reordering that jsPDF's per-glyph pipeline can't produce correctly, so it renders garbled output. The fix: each PDF page is first drawn to an offscreen `<canvas>` using the browser's own text renderer (which shapes Devanagari correctly), then that canvas is embedded into the PDF as a raster image via `doc.addImage()`. A self-hosted Noto Sans Devanagari font (`public/fonts/NotoSansDevanagari.ttf`, OFL-licensed, loaded via `@font-face` in `src/index.css`) guarantees correct glyphs regardless of the visitor's OS fonts — the code explicitly waits on `document.fonts.ready` before drawing to canvas. This stays fully client-side; no backend or font-shaping service involved.

**Question count logic:** every topic has exactly 30 questions, so max-available for any selection = `30 × number of selected topics`. No need to fetch files just to compute a max.

**History:** every attempt (any mode) is saved to the sql.js database with a full snapshot (each question + user's answer + correct answer + explanation) plus a `retry_config_json` describing how to regenerate the same scope with fresh random questions. History is **read-only for review**; the **Retry** button re-runs the same mode/scope/question-count/timer but with a brand-new random draw (never replays the literal same questions) and creates a new history entry — old entries are never deleted by Retry.

**Question randomization at render time:** in addition to sampling which questions appear, each question's **option order is shuffled per-play** (with `correctIndex` remapped accordingly) so the same question doesn't always show its answer in the same position.

## Folder structure

```
quiz-app/
  docs/
    syllabus.txt            # original trade syllabus (source of truth for topics)
    GENERATION_SPEC.md       # exact spec used to generate the question bank
    PROJECT_HISTORY.md       # full narrative of the project's design conversation — keep updated
  public/
    sql-wasm.wasm
    fonts/
      NotoSansDevanagari.ttf  # self-hosted, OFL — guarantees correct Devanagari shaping everywhere
    questions/
      manifest.json
      all-questions.json     # generated — see scripts/merge-questions.mjs
      Unit1_.../*.json ... Unit16_.../*.json
      General_Mathematics/*.json
      General_Physics/*.json
      General_Chemistry/*.json
      practice-sets/
        index.json            # generated — set list + question counts
        set-01.json ... set-30.json  # generated — each a FIXED list of 100 questions
      unit-practice-sets/      # generated (WIP, feature/unit-practice-sets branch) — per-Trade-Unit fixed sets
        index.json              # generated — per-unit set list, question counts, topic labels
        Unit1_.../set-01.json ... # generated — each a FIXED list of ≤100 questions, whole topics only
  scripts/
    merge-questions.mjs        # rebuilds all-questions.json from manifest + topic files
    generate-practice-sets.mjs # rebuilds the 30 fixed practice-sets/set-NN.json files (seeded, reproducible)
    generate-unit-practice-sets.mjs # rebuilds unit-practice-sets/ from current Trade Unit topic files (flexible set count/size per unit)
  src/
    db/          # sql.js init + persistence, history CRUD
    data/        # question bank loading/sampling helpers (incl. loadPracticeSet, loadUnitPracticeSet)
    pdf/         # practiceSetPdf.js — client-side PDF generation (canvas-rendered for Devanagari)
    pages/       # Home, Setup, Quiz, Review, History, PracticeSets, UnitPracticeSets
    components/  # Timer, shared UI bits
```

## Maintenance expectation

This project is meant to be **reused and extended later** (possibly in other contexts/sessions). Whenever a meaningful decision is made or the design changes, **update `docs/PROJECT_HISTORY.md`** so a fresh Claude Code session (with no memory of this conversation) can pick up full context just by reading the docs folder.

## Commands

```
npm run dev       # local dev server
npm run build     # production build -> dist/ (packaged into the Docker image at deploy time)
npm run preview   # preview the production build locally
```

## Deployment (Render, via Docker)

The project deploys as a **Docker web service** on Render (chosen over Render's native Static Site so the whole runtime — including serving the wasm/JSON assets with correct headers — is pinned in one Dockerfile, not dependent on Render's static-site defaults):

- `Dockerfile` — multi-stage: `node:20-alpine` builds (`npm ci && npm run build`), then `nginx:alpine` serves the resulting `dist/`.
- `nginx.conf.template` — templated nginx config (uses `${PORT}`, substituted at container start via nginx's built-in `envsubst`-on-templates mechanism — Render injects its own `PORT`, don't hardcode it). Handles SPA fallback (`try_files ... /index.html`) and sets `application/wasm` for the sql.js wasm file.
- `.dockerignore` — keeps `node_modules`/`dist`/`.git` out of the build context.

No `render.yaml` — Render's free tier only supports web services configured manually via the dashboard (Blueprints/`render.yaml` require a paid plan), so the service is set up by hand: New → Web Service → connect this repo → Runtime: **Docker** → Render auto-detects the `Dockerfile`.

There is still **no database service, no backend, no env vars required** — sql.js + IndexedDB run entirely in the visitor's browser, same as before. Docker only changes *how the static files are served*, not the app's architecture.

Local test: `docker build -t quiz-app . && docker run -p 8080:80 quiz-app` (defaults to port 80 inside the container; override via `-e PORT=xxxx` if needed).

