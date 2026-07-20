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

**Modes:** Topic-wise, Unit-wise, Multi-Unit, Custom (topic-level tree picker), Practice Sets (1–30), History.

**Two behavior modes:**
- **Learning Mode** (Topic / Unit / Multi-Unit / Custom): pick an option → immediate correct/wrong feedback + explanation shown → answer locks. Previous/Next both navigate freely.
- **Exam Mode** (Practice Sets 1–30): no feedback until final Submit. Previous/Next can freely change answers before submitting. Full result + review only appears after Submit.

**Timer:** user sets it (or "No Timer") in every mode, including Practice Sets. When it hits zero: **show a warning only** — do NOT auto-submit. User must submit manually.

**Practice Sets (1–30):** these are **not** pre-baked fixed content — each is just a labeled entry point. Every time one is played (first time or retry), it draws **100 fresh random questions from the full 5,100-question pool**. All 30 sets are functionally identical; only the label differs (for history/tracking purposes).

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
    questions/
      manifest.json
      all-questions.json     # generated — see scripts/merge-questions.mjs
      Unit1_.../*.json ... Unit16_.../*.json
      General_Mathematics/*.json
      General_Physics/*.json
      General_Chemistry/*.json
  scripts/
    merge-questions.mjs       # rebuilds all-questions.json from manifest + topic files
  src/
    db/          # sql.js init + persistence, history CRUD
    data/        # question bank loading/sampling helpers
    pages/       # Home, Setup, Quiz, Review, History, PracticeSets
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

