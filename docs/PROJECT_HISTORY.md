# Project History — Quiz App

Narrative log of how this project was designed and built, in order. Read this before making changes if you're a fresh Claude Code session with no memory of the original conversation — it explains **why**, not just **what**.

Keep this file updated whenever a real decision is made or changed. Append, don't rewrite history — if a decision changes later, add a new dated entry saying what changed and why, rather than editing the old entry away.

---

## 2026-07-20 — Origin

**The ask:** Build a quiz/practice-test system based on `syllabus.txt` (ITI Electronic Mechanic / Mechanic Radio & TV trade). User wanted: topic-wise quizzes, built up into unit-wise, multi-unit, and freely-selectable-unit quizzes; a practice-set mode where the user picks number of questions and a timer; questions drawn randomly from the whole syllabus; full history of every quiz/practice attempt with questions+answers; and specifically **30 pre-made practice sets**, always freshly randomized. User was explicit: *"mere pass questions v nhi h"* — no question bank existed yet, and asked for an analysis of how this would be built before any code was written.

**Key early decisions (via clarifying questions):**
- Question bank source: **AI-generated** directly (not sourced from an existing bank), at **ITI/Diploma level, slightly tough**, no separate human-review pass required before use.
- Platform: **browser-based web app**, no login (single personal user).
- Bank size: initially discussed as ~1000-1200 (10-12/topic), but the user then specified a hard target: **30 practice sets, each at least 100 questions, 5,000 questions total**.

## Building the question bank

Syllabus was broken into **170 topics** across **19 subject/unit groups**: the 16 trade units (Analog/Digital Electronics, Microcontrollers 8051/PIC, Sensors/Transducers, UPS/Inverters/SMPS, SMD Soldering, Cable Harnessing, Computer Hardware/OS/Networking, Digital Panel Meter, Solar Power, LED/TV/CCTV, Cell Phones, Domestic Appliances, PLC, AC/DC Machines & Drives, Servo Motor, Electro Pneumatics) plus General Mathematics (18 topics), Physics (9), Chemistry (12). Every topic was mapped to the exact syllabus wording so nothing was missed — this mapping is preserved in `manifest.json`.

Target settled at **30 questions per topic** (170 × 30 = 5,100, comfortably over the 5,000 floor and evenly divisible for the 30 practice sets).

A strict generation spec was written (`docs/GENERATION_SPEC.md`) and question generation was parallelized across many `general-purpose` subagents (one per unit/subject, some further split by topic when a unit was large), each writing directly to its topic's JSON file.

### Language pivot — Hindi (important, do not regenerate content in plain English)

Midway through generation, the user clarified: he is **Hindi-medium** and only ever learned technical vocabulary in English (his own example: *"transformer ko hindi me kya bolte h i don't know, i know only Transformer"*). Translating technical terms to Hindi would make the content useless to him. Two script options were mocked up (Devanagari vs. Roman/Hinglish) and **Devanagari Hindi with embedded English technical terms was chosen** ("Option A"). All already-generated English content was regenerated in this style; the generation spec was updated with this as **Rule 0** so it's never lost. This preference is also saved in Claude's persistent memory (`quiz-language-hinglish` memory entry) but is duplicated here because the project needs to be self-contained and portable to contexts where that memory isn't loaded.

### Generation was rocky — session limits

Anthropic session/rate limits were hit repeatedly mid-generation (agents failing with "hit your session limit" errors at several different reset times over the course of the day). The recovery pattern used each time: **re-audit the actual files on disk** (a PowerShell script that walks `manifest.json`, tries to parse every topic file, and reports MISSING / BADJSON / wrong-question-count / wrong-language), then re-launch agents **only for the files still missing or broken** — never redo files that already validated correctly. This is why generation happened in several waves rather than one shot. Final state, fully verified: **all 170 files present, valid JSON, Devanagari Hindi, exactly 30 questions each — 5,100 questions total.**

## Product design (decided before writing any app code, per user's request)

The user explicitly asked to finalize *how* the system works before touching code. Full design conversation, distilled:

**Modes:** Topic-wise, Unit-wise, Multi-Unit, Custom (free topic-level selection), Practice Sets (1–30), History.

**Two distinct interaction modes, chosen per quiz mode:**
- **Learning Mode** (Topic/Unit/Multi-Unit/Custom): feedback is immediate — as soon as an option is picked, correct/wrong + explanation shows and the answer locks. Reasoning: these modes are for *learning*, so instant feedback reinforces understanding. Previous/Next both work (to re-read earlier explanations), but you can't change a locked answer.
- **Exam Mode** (Practice Sets): no feedback until final Submit — mimics a real exam. Previous/Next can freely change any answer before submitting. Full result + review appears only after Submit. This distinction (learning vs. exam feel) was a specific, deliberate user choice, not a default — don't collapse these into one behavior.

**Timer:** available in every mode (including Practice Sets), always **user-configured at start** (or "No Timer"). When it expires: **only a warning is shown, never an auto-submit** — the user explicitly rejected auto-submit-on-expiry.

**Practice Sets (1–30) — the trickiest decision:** initially conceived as 30 *fixed, pre-baked* sets (so "Set 7" always means the same 100 questions, for consistency/shareability). The user later added a requirement that **retrying from history should give random questions, not a replay**. This created a real tension (fixed identity vs. always-random), which was resolved by asking directly: **all 30 sets pull from the same full 5,100-question pool, completely randomly, every single time they're played — first time or retry.** So there is no pre-baked content at all; "Practice Set 12" is just a label used for organizing history entries, not a fixed question list. Don't reintroduce fixed pre-baked sets without re-confirming with the user — this was a considered reversal of the original plan.

**History & Retry:**
- Every attempt (any mode) is saved with a full snapshot: every question shown, the user's answer, the correct answer, the explanation, score, time taken, mode/scope label.
- History is **read-only** for review — opening a past attempt just shows what happened, it does not let you "resume" or replay the exact same question set.
- A **Retry** action exists per history entry: it reruns the *same configuration* (same mode, same scope/topics, same question count, same timer) but draws a **fresh random set of questions** — never the literal same ones. This creates a brand-new history entry; the old one is never deleted or overwritten.
- Additionally, at render time each question's **option order is reshuffled** (with the correct-answer index remapped) on every play, so even the same question doesn't always show its answer in the same position across replays.

**Question-count math:** every topic has exactly 30 questions (by construction), so "max available questions" for any topic/unit/multi-unit/custom selection is simply `30 × (number of topics selected)` — no need to fetch files just to count.

## Tech stack decision

User's own instruction: **React**, storage via **"local storage sqlite"**, deployed to **Render**. Interpreted concretely as:
- React + Vite (fast static build, deploys cleanly to Render as a Static Site — no backend needed since there's no login/multi-user requirement).
- **sql.js** (SQLite compiled to WebAssembly) for the history database, running entirely client-side.
- **idb-keyval** to persist the serialized sql.js database into IndexedDB, so history survives reloads (plain `localStorage` alone isn't a great fit for a growing binary SQLite blob; IndexedDB is the standard pairing with sql.js).
- **react-router-dom** for screen navigation (Home / Setup / Quiz / Review / History / Practice Sets).
- **Tailwind CSS v4** for styling, since the user asked for the result to look polished ("sb kuch badhiya se hona chahaiye").

## Project self-containment

The user asked for the **entire project** — question bank, source syllabus, generation spec, and this history doc — to live **inside `quiz-app/`** (not scattered in the parent folder), specifically because this project may be reused or relocated elsewhere later. The original `Syllabus/questions/` and `Syllabus/syllabus.txt` were moved in under `quiz-app/public/questions/` and `quiz-app/docs/syllabus.txt` respectively (verified file-count match before deleting the old copies). `CLAUDE.md` was added at the project root so any future Claude Code session opening this folder immediately gets oriented without needing this conversation's memory.

## Status as of this entry

Question bank: **done** (5,100 questions, 170/170 topics, verified). App scaffold: Vite + React created, dependencies installed (react-router-dom, sql.js, idb-keyval, Tailwind v4), question bank + sql-wasm.wasm copied into `public/`. **App code itself (db layer, routing, pages, quiz engine) is being written next** — if you're picking this up mid-way, check `src/` for what actually exists versus what's described in `CLAUDE.md`'s folder structure section, since that describes the target layout.

## 2026-07-20 (later same day) — First working build

Full app written end-to-end: `src/db/sqlite.js` + `historyService.js` (sql.js + idb-keyval persistence), `src/data/questionBank.js` (manifest/topic loading, sampling, per-play option shuffling), and pages `Home`, `Setup` (handles topic/unit/multiunit/custom via one component, custom mode uses a checkbox tree with a "select whole syllabus" shortcut), `PracticeSets`, `Quiz` (the shared engine for both Learning Mode and Exam Mode per the earlier spec), `Review`, `History`.

**Bugs found and fixed during this pass:**
- 3 of the 170 generated topic files (`Unit5/smd_package_sizes.json`, `Unit11/gsm_cdma.json`, `Unit13/plc_programming.json`) had raw unescaped newline characters inside JSON string values (an artifact from generation) — invalid JSON. Wrote `scripts/find-bad-json.mjs` (scans all 170 files) and `scripts/repair-json.mjs` (walks the raw text char-by-char, tracks whether it's inside a string, escapes any raw control character it finds) to fix them in place without touching content. Re-verified: all 170 files valid again, 5,100 questions confirmed.
- Added `scripts/merge-questions.mjs`, which flattens all 170 topic files into `public/questions/all-questions.json` (each question tagged with unit/topic metadata) so Practice Sets and any "whole syllabus" selection don't require 170 separate fetches — one file covers it. **Re-run this script whenever a topic JSON file changes.**

**Verified so far:** `npm run build` succeeds cleanly; `public/sql-wasm.wasm` and all of `public/questions/*` (172 files: manifest + all-questions + 170 topics) copy into `dist/` correctly; `vite preview` serves deep routes like `/history` and `/setup/topic` with 200 (SPA fallback works). Added `public/_redirects` (`/*  /index.html  200`) and `render.yaml` so the same SPA fallback works once deployed on Render, not just locally.

**Not yet verified:** actual in-browser interactive behavior (clicking through a real quiz, confirming sql.js/IndexedDB persistence survives a reload, confirming the timer counts down visually, confirming Tailwind styling renders as intended) — this was checked via build output and static asset serving only, not by driving a real browser. Run `npm run dev` and click through the whole flow (all 4 setup modes, a practice set, submitting a quiz, reloading to confirm history persisted, retrying from history) before considering this production-ready.

**Design point carried over exactly as decided:** Practice Sets have no fixed pre-baked content — `PracticeSets.jsx` always samples fresh from `all-questions.json` regardless of which set number was clicked or whether it's a first play or a Retry. The set number is purely a history/label device.


## 2026-07-20 (later still) — Docker deployment + GitHub push

User decided to deploy via **Docker on Render** instead of Render's native Static Site build, specifically so the deployment isn't dependent on any external service beyond the container itself ("jisse mujhe bahar se kuch use naa karna pare" — so nothing external needs to be used). This does **not** change the architecture — there was never a database service or backend; sql.js + IndexedDB already run entirely client-side. Docker only changes how the built static files are served.

Added: `Dockerfile` (multi-stage: `node:20-alpine` build → `nginx:alpine` runtime), `nginx.conf.template` (SPA fallback + `application/wasm` MIME type, with `${PORT}` templated for Render's dynamic port injection via nginx's built-in envsubst-on-templates mechanism), `.dockerignore`, and `render.yaml` updated to `runtime: docker`. Local Docker build was **not** tested (Docker isn't installed in the dev environment this was built in) — verify with `docker build -t quiz-app . && docker run -p 8080:80 quiz-app` before relying on it.

Project was pushed to `https://github.com/Prabhat9801/quiz-ITI.git` (remote was empty, plain push, no force needed).

**Correction (same day):** `render.yaml` was removed — user is on Render's free tier, which doesn't support Blueprint/`render.yaml`-based deploys (that needs a paid plan). Render service must be created manually via the dashboard instead: New → Web Service → connect the repo → Runtime: Docker (Render auto-detects the `Dockerfile`). No `render.yaml` should be re-added unless the plan changes.
