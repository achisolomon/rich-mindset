# Survey Versions — Design Spec

**Date:** 2026-06-25
**Branch:** `survey-versions` (→ PR into `main`)

## Goal

Run two live, directly comparable versions of the rich-mindset financial-mindset
quiz at separate URLs, plus a landing page linking to both. Architect the codebase
so additional versions (e.g. a shorter quiz) can be added later **without
duplicating or risking the intro and results experience** — those must work
identically in every version.

## Background

The current quiz is a single self-contained `index.html`: 40 questions across 12
categories. Each question is a **binary choice** between two opposing statements
(statement A vs B), rendered as two clickable buttons. Question data lives in a
`CATS` array where each item is a `[statementA, statementB]` pair. Scoring:

- Answer `1` = statement A (poor mindset), `2` = statement B (rich mindset).
- Category and total scores are **averages on a 1→2 scale**, feeding result bands,
  a radar chart, and per-question position markers (`(v-1)*100%`).

Deployed via GitHub Pages from `main` root; `index.html` is the live entry point.

## Architecture: shared core + thin per-version pages

Rather than copy `index.html` per version (which would duplicate and drift the
intro + scoring + results), extract the shared parts into a small set of files.

### Shared files (single source of truth)

- **`quiz.css`** — all styling (currently inline in `index.html`). Every version is
  visually identical. Adds input-mode-specific rules for the 4-radio scale.
- **`quiz-data.js`** — questions (`CATS`), result bands, category metadata, exposed
  as `window.QUIZ_DATA`. A future short version passes a filtered subset.
- **`quiz-core.js`** — exposes `initQuiz({ id, inputMode, cats })`. It **injects the
  shared intro + quiz + results skeleton** into a mount node and owns all logic:
  start/progress, scoring, radar, results, sort, print, restart. Intro and results
  exist here **once**, guaranteeing identical behavior across versions. Only the
  per-question input rendering varies by `inputMode`.

### Per-version pages (thin shells, ~10 lines each)

- **`index.html`** — `initQuiz({ id:'binary', inputMode:'binary', cats })` — the
  2-option version. Refactored from the current monolith into a thin shell; renders
  and behaves identically to today's main (verified against main with screenshots).
- **`scale4.html`** — `initQuiz({ id:'scale4', inputMode:'scale4', cats })` — the
  4-radio version.
- Future e.g. **`short.html`** — same call with a filtered `cats`. Intro + results
  come for free.

### Input modes (the only per-version difference)

- **`binary`** → two statement buttons; stores `1` or `2`.
- **`scale4`** → statement A (right, RTL) and statement B (left) as fixed anchors
  with **4 forced-choice radios** between them, no neutral middle:
  closest-to-A (strongly A) → somewhat A → somewhat B → strongly B (closest-to-B).
  Real `<input type="radio">` grouped per question inside a `<fieldset>`/`<legend>`
  for accessibility (WCAG 2.1 AA per PRODUCT.md). No color-alone meaning; text/aria
  anchors on each side. Stores `1 + idx/3` → `1.0, 1.33, 1.67, 2.0`.

Both modes store a number in `[1,2]`, so shared scoring/results/radar code is
untouched and **directly comparable** across versions. Each version uses its own
localStorage key: `rms_answers_<id>`.

Results-detail rows highlight the nearer statement (`score < 1.5` → A, else B) and
keep the existing position marker, which already works for any value in `[1,2]`.

### Landing page

- **`versions.html`** — two cards linking to `index.html` ("גרסה א׳ — בחירה בין שני
  ניסוחים") and `scale4.html` ("גרסה ב׳ — סולם בן 4 דרגות"), reusing `quiz.css` and
  the brand's warm RTL Hebrew styling.

## Testing

Match the sibling `ai-tool-review` convention: Playwright + `@axe-core/playwright`.
`rich-mindset` has no test setup today, so this establishes one.

Add: `package.json` (`"test": "playwright test"`), `playwright.config.js`, a static
serve script, and `tests/quiz.spec.js` covering both versions:

- **Rendering:** intro shows; `start()` reveals 40 questions; binary renders 2
  buttons/question; scale4 renders exactly **4 radios/question, no neutral middle**.
- **Answer + scoring:** selecting an option records it; answering all enables
  results; total score lands in `[1,2]`; radar renders. Confirms `1 + idx/3`
  (scale4) and `1/2` (binary) yield comparable results.
- **Isolation:** `rms_answers_binary` and `rms_answers_scale4` don't clobber.
- **Landing:** `versions.html` has two links resolving to the two pages.
- **a11y:** axe scan on intro + quiz for each version.

Run with `npm test`. This is what makes future versions safe to add — the shared
intro/results are re-verified automatically.

## Out of scope (YAGNI)

- No analytics/tracking to measure which version converts better (separate addition
  if wanted).
- No changes to the `build_quiz*.py` data scripts; `index.html`/`quiz-data.js` is
  the source of truth.

## Acceptance criteria

1. `index.html` (binary) behaves identically to current main; verified by screenshot.
2. `scale4.html` presents 4 forced-choice radios per question, scores on the 1→2
   scale, and produces a comparable results page.
3. `versions.html` links to both versions.
4. Intro and results are defined once in `quiz-core.js` and shared by all versions.
5. Adding a new version requires only a new thin HTML shell (+ optional data subset).
6. `npm test` passes (rendering, scoring, isolation, landing, a11y).
