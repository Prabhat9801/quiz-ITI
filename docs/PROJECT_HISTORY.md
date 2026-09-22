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

## 2026-07-20 (Render build failure) — Docker build fix

First Render Docker build failed at `npm ci` inside the `node:20-alpine` build stage: `Missing: @emnapi/core@1.11.2 from lock file`, `Missing: @emnapi/runtime@1.11.2`. Root cause: `package-lock.json` was generated on Windows, where npm resolved `lightningcss` (Tailwind v4's CSS engine, a native/napi package) to its Windows binary (`lightningcss-win32-x64-msvc`) plus whatever optional deps that pulled in for that platform. On Linux (the Alpine build container), npm needs the Linux binary + its own optional deps (`@emnapi/core`, `@emnapi/runtime` — the WASM-fallback runtime lightningcss uses on some platforms) instead, which weren't present in the Windows-generated lockfile. `npm ci` requires exact lockfile fidelity, so it failed rather than silently re-resolving.

**Fix:** changed the Dockerfile's build stage from `npm ci` to `npm install` — this lets npm resolve the correct platform-specific optional dependencies fresh, inside the Linux container, instead of trusting a lockfile generated on a different OS. Trade-off: loses `npm ci`'s strict reproducibility guarantee, but that's an acceptable trade for this project given the lockfile is Windows-authored while the deploy target is Linux. If this bites again, the more thorough fix would be generating/committing the lockfile from a Linux environment (or Docker itself) instead.

## 2026-07-20 (bug report) — Number input fields + mobile responsiveness

User reported "number of questions update nahi ho rahe h aur edit nahi ho rahe h" (the question-count field wouldn't update/couldn't be edited). Root cause: all numeric `<input type="number">` fields (question count in `Setup.jsx`, timer minutes in both `Setup.jsx` and `PracticeSets.jsx`) were controlled inputs that clamped to `[1, max]` **on every keystroke via onChange**. Clearing the field to retype a number produces `Number('') === 0`, which immediately got clamped back to `1` before the user could type a fresh value — a classic controlled-input anti-pattern that makes the field feel broken/uneditable.

**Fix:** these inputs now hold the raw string as-typed (no clamping in `onChange`); clamping only happens `onBlur` (when the user leaves the field) and again defensively when actually starting the quiz (`numericQuestionCount`/`numericTimerMinutes` computed at submit time in `handleStart`). This is the standard fix for this class of bug — don't fight the user's keystrokes in a controlled numeric input, only validate at the boundaries (blur / submit).

Same message also asked to **make the whole system fully responsive / mobile-friendly**. Did a pass across every page: `App.jsx` header (sticky, truncating title), `Home.jsx` (1-col on mobile), `Setup.jsx` (full-width inputs on mobile, bigger touch targets — checkboxes bumped to `h-5 w-5` on mobile, row padding increased), `PracticeSets.jsx` (practice-set grid adapts 4→6→8 columns by breakpoint), `Quiz.jsx` (the fixed bottom action bar was the riskiest spot — button labels now show short text on mobile (`"← Prev"`, `"Submit"`) and full text from `sm:` up, since 3 buttons plus a long Hindi label like "Quiz Khatam Karo" doesn't fit a ~320-375px screen at full size), `Review.jsx` and `History.jsx` (button rows and score/stat rows now wrap instead of overflowing on narrow screens).

**Not tested in an actual mobile browser/device emulator** — this was a Tailwind-breakpoint code review, not a driven test. Verify at real narrow widths (320px, 375px, 414px) before calling it done.

## 2026-07-20 (follow-up bug) — "Number of Questions" field truly not editable

User sent a screenshot (Topic-wise Setup page, no Unit selected yet): the "Number of Questions" box looked like a normal white input but literally could not be typed into. Real cause this time (different from the earlier onChange-clamping bug): the input had `disabled={maxAvailable === 0}` — and `maxAvailable` is 0 until a Unit+Topic (or Unit, or any topics in multiunit/custom) is actually selected. So on first load, before any selection, the field is genuinely HTML-disabled, but nothing in its styling signaled that, so it read as broken rather than as "pick a topic first."

**Fix:** removed the `disabled` attribute entirely — the field is now always editable, at any point, regardless of selection state. The Start button (`canStart = maxAvailable > 0 && ...`) is still what actually gates starting the quiz, so this doesn't let you start with a bogus count; it just stops the input itself from ever appearing broken. Also softened the onBlur clamp so that with no selection yet (`maxAvailable === 0`) it only enforces a minimum of 1, not an artificial max of 1 — so a typed value like "25" survives until a topic is actually picked, at which point the existing clamp-down effect (only shrinks the value if it now exceeds the real max) takes over correctly. Added a small hint line under the field ("Pehle upar selection karo, max yahan dikhega") for when max is still unknown.

## 2026-07-20 (deployed bug) — sql.js WASM 404 broke DB init (and therefore "Finish Quiz")

User hit "Quiz Khatam Karo" on the deployed Render site and nothing happened; DevTools console showed `sql-wasm-browser.wasm` 404ing, sql.js falling back to ArrayBuffer instantiation, that also failing, and an uncaught `RuntimeError: Aborted(both async and sync fetching of the wasm failed)`.

**Root cause:** `sql.js`'s `package.json` has a conditional export — `"browser": "./dist/sql-wasm-browser.js"` vs `"default": "./dist/sql-wasm.js"`. Vite's browser build resolves the `browser` condition, so the actual bundled code calls for `sql-wasm-browser.wasm` at runtime — but only `sql-wasm.wasm` had been manually copied into `public/` earlier (the wrong variant), so the real request 404'd. Since `saveAttempt()` (called from `Quiz.jsx`'s `handleSubmit`) awaits `getDb()` which awaits `initSqlJs(...)`, that promise never resolved — so the button didn't just fail to look right, it silently never finished its click handler. Same root cause explained both the WASM console errors and the seemingly-dead "Finish Quiz" button; wasn't two separate bugs.

**Fix:** stopped hand-copying a single wasm file and instead added `scripts/copy-sqljs-wasm.mjs`, wired up as `"postinstall"` in `package.json` — every `npm install` (including the one `RUN npm install` does inside the Docker build) now copies **every non-debug `.wasm` variant** (`sql-wasm.wasm` AND `sql-wasm-browser.wasm`) from `node_modules/sql.js/dist/` into `public/`. This makes it resolution-proof: whichever variant Vite happens to pick (dev vs. prod, or if sql.js's export conditions change in a future version) will already be present, instead of relying on knowing in advance which one is "the right one."

**Also clarified for the user:** History is saved for **every quiz mode** (Topic-wise, Unit-wise, Multi-Unit, Custom, and Practice Sets) — not Practice Sets only. `saveAttempt()` is called unconditionally from `Quiz.jsx`'s `handleSubmit` regardless of `state.mode`, so this was already correct; it just hadn't been visible before because the DB was silently failing to initialize.

## 2026-07-20 (Docker build failure #2) — postinstall fired before source was copied

The `postinstall` hook from the previous fix broke the Docker build itself: `Error: Cannot find module '/app/scripts/copy-sqljs-wasm.mjs'`. Cause: the Dockerfile copies only `package.json`/`package-lock.json` first (for layer-caching), runs `npm install` (which fires `postinstall` immediately), and only *then* runs `COPY . .` to bring in the rest of the source — so at the moment `postinstall` ran, `scripts/` didn't exist in the image yet.

**Fix:** renamed the hook from `postinstall` to `prebuild` (and added `predev` for local convenience) — npm's `pre<script>` convention runs it automatically right before `npm run build` / `npm run dev`, both of which only get invoked after `COPY . .` has already happened (in Docker) or after a normal git clone (locally). This sidesteps the install-vs-source-copy ordering problem entirely instead of fighting the Dockerfile's layer order. Verified locally by deleting `public/*.wasm` and confirming `npm run build` regenerates them via the `prebuild` step before `vite build` runs.

## 2026-07-31 — Practice Sets made fixed content + PDF export added

**The ask:** user wanted every Practice Set (1–30) to be downloadable as a PDF. Flagged the conflict up front before writing code: Practice Sets were designed (see above, 2026-07-20 origin) to **never** be fixed content — every play/retry drew 100 fresh random questions from the 5,100-question pool, specifically so "all 30 sets are functionally identical, only the label differs." A PDF export fundamentally needs stable, unchanging content, which contradicts that. Two options were presented: (A) make the 30 sets permanent/fixed so each has one stable PDF, or (B) keep sets random but let users download a PDF of one specific completed attempt (already snapshotted in history) instead of "the set" as an abstract thing. **User chose (A).**

**What changed:**
- `scripts/generate-practice-sets.mjs` (new) — deterministically shuffles the full `all-questions.json` pool with a **fixed seed (42, mulberry32 PRNG)** and slices it into 30 non-overlapping chunks of 100 questions each, writing `public/questions/practice-sets/set-01.json` … `set-30.json` (+ an `index.json`). Re-running this script always reproduces the exact same 30 sets, as long as the underlying question bank hasn't changed — this reproducibility is what makes "the PDF for Set 7" a stable, meaningful artifact. Only 3,000 of the 5,100 questions end up in a set; the rest remain available to Topic/Unit/Multi-Unit/Custom modes as before.
- `src/data/questionBank.js` — added `loadPracticeSet(setNumber)` (fetches the fixed set file, cached) and `prepareFixedQuizQuestions(questions)` (shuffles question order + each question's option order for the on-screen play, but does **not** re-sample from the pool — the 100 questions themselves never change). The old `loadAllQuestions()` + `prepareQuizQuestions()` random-sampling path is now only used by Topic/Unit/Multi-Unit/Custom modes.
- `src/pages/Quiz.jsx` / `PracticeSets.jsx` — practice-set mode now carries a `practiceSetNumber` through quiz state and retry-config (so Retry replays the *same* set, freshly reshuffled, rather than drawing a new random 100) and loads via `loadPracticeSet` instead of `loadAllQuestions`.
- `src/pdf/practiceSetPdf.js` (new, uses `jspdf`) — generates two PDFs per set: a blank worksheet (questions+options only) and an answer-key version (+ correct answer marked, + explanations). Also added `downloadAttemptReviewPdf` for exporting any single completed attempt from the Review screen (covers option (B) from above too, as a bonus — useful for reviewing/printing a specific past attempt, not just the abstract set).
- **Critical implementation detail — Devanagari text shaping:** all content is Hindi (Devanagari script). jsPDF's own text-drawing API (`doc.text(...)`, even with a custom Devanagari TTF registered via `addFont`) does **not** perform real Unicode/OpenType shaping — Devanagari needs conjunct-consonant ligatures (क्ष, त्र, ज्ञ) and matra reordering that jsPDF's naive per-glyph pipeline gets wrong, producing garbled output. This was caught **before** writing the renderer (researched via a dedicated fact-finding subagent) rather than discovered after shipping broken PDFs. The fix: every PDF page is drawn to an offscreen `<canvas>` first — using the browser's own native text renderer, which does correct Indic shaping — and that canvas is then embedded into the PDF as a raster (JPEG) image via `doc.addImage()`. A self-hosted `Noto Sans Devanagari.ttf` (OFL-licensed, `public/fonts/`, registered via `@font-face` in `src/index.css`) guarantees this renders identically regardless of the visitor's OS/device fonts; the renderer explicitly awaits `document.fonts.ready` before drawing. Verified end-to-end with a real headless-browser run (Playwright + the production `preview` build) clicking through Practice Sets → Set 1 → "Answer Key PDF" and visually inspecting the rendered canvas pages — conjuncts and matras render correctly, not as boxes/garbage.
- **Trade-off accepted:** rasterizing each page as an image means the PDF text isn't selectable/searchable/copyable (it's an image of text, not real text). This was the deliberate choice over shipping garbled "real" text — correctness over that one feature. If selectable text is ever wanted, it would need a proper Devanagari-shaping engine (e.g. HarfBuzz via WASM) feeding pre-shaped glyph runs into jsPDF, which is a much larger undertaking.
- Verified `npm run build` still succeeds; noted (pre-existing, unrelated to this change) that `npm run dev`'s Vite dep-optimizer currently throws on `sql.js`'s module shape (`does not provide an export named 'default'`) in this Vite version — this doesn't affect the production build or this feature, so it wasn't fixed as part of this task, but is worth a look separately (same underlying "browser vs default export condition" quirk as the 2026-07-20 sql.js WASM entry above).

## 2026-09-22 — Unit Practice Sets (per-topic exhaustive coverage, new mode)

**The ask:** user wants every topic to have enough questions that after practicing them, the topic's syllabus/theory never needs to be re-studied — practice fully replaces reading the book. Concretely: for each of the **16 Trade Units** (Math/Physics/Chemistry excluded — user said "unit" specifically means the trade units), grow every topic's question file well beyond the original fixed 30, then repackage each unit's full question pool into a **new, separate mode called "Unit Practice Sets"** — fixed sets of ~100 questions each, grouped by whole topics, unit-filtered, with each set labeled by which topics it covers (so a student always knows exactly what a set drills).

**How the per-topic target counts were decided:** rather than force every unit to the same size (which the user's own combination of "5 sets, 100 Q/set" implied — 500 Q/unit — but no unit's real content supports that; unit pools range from ~150 to ~420 today), the syllabus text for each of the 131 trade topics was read and scored by how many genuinely-distinct question angles its actual content supports (definitions, working principle, advantages/disadvantages, comparisons, numericals, applications — roughly 4-8 angles per distinct sub-concept named in the syllabus). This produced a per-topic target range (documented to the user in-chat, e.g. IMEI ~15-25, IC 7106/7107 ~40-50, 8051 instruction set ~80-100), summing to **~5,900 questions total** (vs. today's 3,930) — i.e. **~1,975 new questions**, unevenly spread (Unit2 Microcontroller needs the most depth, ~755; Unit11 Cell Phones and Unit15 Servo Motor the least, ~165 and ~205, because their syllabus paragraphs are genuinely short). User explicitly confirmed **set-count and set-size should be flexible per unit** rather than forcing a fixed 5-sets/100-Q-per-unit structure — a thin unit ends up with 2 sets, a dense one with 7-8.

**Structure (user confirmed explicitly):**
- Unit Practice Sets is unit-filtered: pick a Unit first, then see that unit's sets.
- Each set is capped at 100 questions, built by packing **whole topics** (never splitting one topic's questions across two sets, unless a single topic's own pool exceeds 100 — not expected to happen here) — greedy: keep adding whole topics to the current set until the next one would push it over 100, then start a new set.
- Every set displays which topic(s) it contains (e.g. "Set 1: Transistors Basics + Transistor Amplifiers") so preparation stays organized — this was the specific UX ask ("set me kis topic se mila hai wo bataye").
- Sets are **fixed/permanent** content (same convention as the existing global Practice Sets 1-30) so Retry replays the same set and PDF export stays meaningful — only on-screen question order and each question's option order reshuffle per play.

**Implementation:**
- `scripts/generate-unit-practice-sets.mjs` (new) — reads `manifest.json`'s Trade units, reads every topic file fresh off disk (so it always reflects however many questions currently exist per topic), greedily packs whole topics into ≤100-question sets per unit, writes `public/questions/unit-practice-sets/<UnitFolder>/set-NN.json` + a top-level `index.json` (per-unit `totalQuestions`, `totalSets`, and each set's `topics` label list). Deterministic/idempotent — safe to re-run any time a unit's topic files change; no seed/randomness needed since nothing is sampled, whole topics are just concatenated in manifest order.
- `src/data/questionBank.js` — added `loadUnitPracticeSetsIndex()` and `loadUnitPracticeSet(folder, setNumber)`, mirroring the existing `loadPracticeSet` pattern.
- `src/pdf/practiceSetPdf.js` — added `downloadUnitPracticeSetWorksheetPdf(label, questions)` / `downloadUnitPracticeSetAnswersPdf(label, questions)`, generic versions of the existing Practice-Set PDF functions that take a caller-supplied label instead of an assumed "Practice Set N" title (reuses the same canvas-rendered Devanagari-safe pipeline).
- `src/pages/UnitPracticeSets.jsx` (new) — Unit picker → that unit's sets (each showing question count + topic labels) → timer setup + Start / PDF download, same interaction pattern as `PracticeSets.jsx`.
- `src/pages/Quiz.jsx` — new `state.mode === 'unitpracticeset'` branch (loads via `loadUnitPracticeSet(state.unitFolder, state.unitSetNumber)`, same `prepareFixedQuizQuestions` treatment as global Practice Sets); `unitFolder`/`unitSetNumber` added to the saved `retryConfig` so History's Retry button replays the same fixed set.
- `src/App.jsx` / `src/pages/Home.jsx` — new route `/unit-practice-sets` and a new Home card ("Unit Practice Sets").
- New content questions were generated by **one `general-purpose` subagent per topic file, launched in parallel** per unit (this session's user explicitly asked for the multi-agent approach, "jitne bhi topics hain utne agent chala do" — "run as many agents as there are topics" — for speed), each agent scoped to its topic's exact syllabus wording (to avoid overlapping a sibling topic's content) and told to append new questions after the existing 30 (continuing the id sequence), following `docs/GENERATION_SPEC.md` exactly and cross-checking against the existing 30 for duplicate concepts.
- **Everything for this feature lives on a dedicated branch, `feature/unit-practice-sets`**, kept separate from `main` per the user's explicit request, until the user reviews and asks for it to be merged/pushed to the shared remote branch.
- **Still to do when resuming this work:** finish content generation for the remaining Trade Units beyond Unit1 (same per-topic-subagent pattern), re-run `node scripts/merge-questions.mjs` after every batch of new questions (so `all-questions.json` stays in sync — this is used by other modes, not by Unit Practice Sets directly, but must not be allowed to drift), then re-run `node scripts/generate-unit-practice-sets.mjs` to rebuild the sets for whichever units changed, and update the total-question-count figures quoted in `CLAUDE.md`/`Home.jsx` ("170 topics, 5,100 questions") once the bank size actually changes.
