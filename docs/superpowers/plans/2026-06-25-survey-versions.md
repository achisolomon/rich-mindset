# Survey Versions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two live, comparable versions of the rich-mindset quiz — the existing binary (2-option) version and a new 4-radio version — at separate URLs, plus a landing page, built on a shared core so future versions reuse one intro + results implementation.

**Architecture:** Extract the current monolithic `index.html` into shared files (`quiz.css`, `quiz-data.js`, `quiz-core.js`). `quiz-core.js` injects the shared intro/quiz/results skeleton and owns all logic; per-question input rendering is delegated to a per-mode object (`binary` | `scale4`). Each version is a ~12-line HTML shell calling `initQuiz({id, mode, cats})`. Both modes store a number in `[1,2]`, so scoring/results/radar are untouched and comparable.

**Tech Stack:** Vanilla HTML/CSS/JS (no build step), Chart.js (CDN, already used), Playwright + @axe-core/playwright for tests, Python `http.server` for the static test server.

---

## File Structure

- `quiz.css` — **new.** All styles, extracted verbatim from `index.html` lines 9–614, plus a `.sr-only` helper and a `.scale4-*` block.
- `quiz-data.js` — **new.** `window.QUIZ_DATA = { cats, bands }` — `CATS` (lines 719–780) and `BANDS` (783–788) moved verbatim.
- `quiz-core.js` — **new.** `window.initQuiz(config)`; shared skeleton + all logic (start, buildQuiz, pick, updateProgress, showResults, renderBreakdown, renderAnswers, drawRadar, setSortMode, restart) refactored from lines 792–1131, parameterized by `config.id`/`config.mode`/`config.cats`/`config.introHtml`. Holds the `MODES.binary` and `MODES.scale4` renderers.
- `index.html` — **rewritten** into a thin shell (binary mode). Behaves identically to current main.
- `scale4.html` — **new.** Thin shell (scale4 mode).
- `versions.html` — **new.** Landing page linking to both, reusing `quiz.css`.
- `package.json`, `playwright.config.js` — **new.** Test harness.
- `tests/helpers.js` — **new.** Shared Playwright helpers.
- `tests/binary.spec.js`, `tests/scale4.spec.js`, `tests/results.spec.js`, `tests/isolation.spec.js`, `tests/landing.spec.js`, `tests/a11y.spec.js` — **new.**

**Working directory for all paths below:** repo root `/Users/achisolomon/Documents/Git-Achi-gmail/rich-mindset`. Branch: `survey-versions` (already created). All commands run from repo root.

---

## Task 1: Test harness scaffolding

**Files:**
- Create: `package.json`
- Create: `playwright.config.js`
- Create: `tests/helpers.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "rich-mindset",
  "version": "1.0.0",
  "private": true,
  "description": "Financial-mindset self-assessment quiz (binary + 4-radio versions)",
  "scripts": {
    "serve": "python3 -c \"import functools; from http.server import HTTPServer, SimpleHTTPRequestHandler; HTTPServer(('127.0.0.1', 4321), functools.partial(SimpleHTTPRequestHandler, directory='.')).serve_forever()\"",
    "test": "playwright test"
  },
  "devDependencies": {
    "@axe-core/playwright": "^4.10.0",
    "@playwright/test": "^1.48.0"
  }
}
```

- [ ] **Step 2: Create `playwright.config.js`**

The static server is started by Playwright via `webServer`. `python3 -m http.server` is reused with an explicit `directory` so it never calls `os.getcwd()` (the sandbox-safe form proven during setup).

```js
const { defineConfig } = require('@playwright/test');

const PORT = process.env.PORT || 4321;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  webServer: {
    command: `python3 -c "import functools; from http.server import HTTPServer, SimpleHTTPRequestHandler; HTTPServer(('127.0.0.1', ${PORT}), functools.partial(SimpleHTTPRequestHandler, directory='.')).serve_forever()"`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
```

- [ ] **Step 3: Create `tests/helpers.js`**

```js
const { expect } = require('@playwright/test');

// Total number of questions across all 12 categories.
const TOTAL_ITEMS = 36;

// Number of categories.
const TOTAL_CATS = 12;

/**
 * Answer every question on a quiz page that is already showing the quiz form.
 * mode 'binary' clicks statement-A buttons; mode 'scale4' picks the first radio
 * of each question. Returns once the results button is enabled.
 */
async function answerAll(page, mode) {
  if (mode === 'binary') {
    const buttons = page.locator('#items .stmt.right');
    const n = await buttons.count();
    for (let i = 0; i < n; i++) await buttons.nth(i).click();
  } else {
    // Pick the first radio (index 0) of every question.
    const groups = page.locator('#items .scale4-radios');
    const n = await groups.count();
    for (let i = 0; i < n; i++) {
      await groups.nth(i).locator('input[type="radio"]').first().check();
    }
  }
  await expect(page.locator('#showBtn')).toBeEnabled();
}

/** Open a version page and click "start" to reveal the quiz form. */
async function startQuiz(page, path) {
  await page.goto(path);
  await page.getByRole('button', { name: /נתחיל/ }).click();
  await expect(page.locator('#quiz')).toBeVisible();
}

module.exports = { TOTAL_ITEMS, TOTAL_CATS, answerAll, startQuiz };
```

- [ ] **Step 4: Install dependencies and the browser**

Run:
```bash
npm install
npx playwright install chromium
```
Expected: dependencies install; Chromium downloads. (If `npx playwright install` is blocked offline, note it and continue — tests need it to run.)

- [ ] **Step 5: Commit**

```bash
git add package.json playwright.config.js tests/helpers.js
git commit -m "test: add Playwright harness and helpers"
```

---

## Task 2: Baseline regression test for current binary quiz

This locks the CURRENT behavior so the refactor in Task 4 is provably identical. Written against the live `index.html` before any change.

**Files:**
- Create: `tests/binary.spec.js`

- [ ] **Step 1: Write `tests/binary.spec.js`**

```js
const { test, expect } = require('@playwright/test');
const { TOTAL_ITEMS, answerAll, startQuiz } = require('./helpers');

test('intro shows then start reveals all questions as 2-button rows', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#intro')).toBeVisible();
  await expect(page.locator('#quiz')).toBeHidden();

  await page.getByRole('button', { name: /נתחיל/ }).click();
  await expect(page.locator('#quiz')).toBeVisible();

  // Each question renders exactly two statement buttons.
  await expect(page.locator('#items .item')).toHaveCount(TOTAL_ITEMS);
  await expect(page.locator('#items .stmt')).toHaveCount(TOTAL_ITEMS * 2);
});

test('answering a question records 1/2 and marks it answered', async ({ page }) => {
  await startQuiz(page, '/index.html');
  const firstItem = page.locator('#items .item').first();
  await firstItem.locator('.stmt.right').click();
  await expect(firstItem).toHaveClass(/answered/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rms_answers') || '{}'));
  expect(stored['0_0']).toBe(1);
});

test('answering all enables results; total renders in [1,2]', async ({ page }) => {
  await startQuiz(page, '/index.html');
  await answerAll(page, 'binary');
  await page.locator('#showBtn').click();
  await expect(page.locator('#results')).toBeVisible();

  const total = parseFloat(await page.locator('#totalNum').textContent());
  expect(total).toBeGreaterThanOrEqual(1);
  expect(total).toBeLessThanOrEqual(2);
  await expect(page.locator('#radar')).toBeVisible();
});
```

- [ ] **Step 2: Run against current index.html — expect PASS**

Run: `npm test -- tests/binary.spec.js`
Expected: 3 passed. (The current monolithic `index.html` already implements all of this — this is the regression baseline, so it passes now and must keep passing after the refactor.)

- [ ] **Step 3: Commit**

```bash
git add tests/binary.spec.js
git commit -m "test: baseline regression spec for binary quiz"
```

---

## Task 3: Extract CSS and data into shared files

Pure extraction — no behavior change yet. `index.html` keeps working because we don't touch it in this task; the new files are added alongside.

**Files:**
- Create: `quiz.css`
- Create: `quiz-data.js`

- [ ] **Step 1: Create `quiz.css`**

Copy the entire contents **between** `<style>` and `</style>` in `index.html` (lines 9–614) verbatim into `quiz.css`. Then append this block at the end (the `.sr-only` accessibility helper and the 4-radio styles, reusing existing tokens):

```css
/* === ACCESSIBILITY HELPER === */
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0);
  white-space: nowrap; border: 0;
}

/* === 4-RADIO BIPOLAR SCALE (scale4 mode) === */
.scale4-item { border: 1.5px solid var(--line); }
.scale4-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: center;
}
.scale4-anchor {
  font-size: 14px;
  line-height: 1.6;
  border-radius: 10px;
  padding: 10px 12px;
}
.scale4-anchor.right { text-align: right; background: #e3eaf4; border: 1.5px solid #1f3864; color: #1f3864; }
.scale4-anchor.left  { text-align: left;  background: #e4efe9; border: 1.5px solid #1a5e36; color: #1a5e36; }

.scale4-radios {
  display: flex;
  flex-direction: row;
  gap: 14px;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}
.scale4-opt {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  min-width: 44px;
  min-height: 44px;
}
.scale4-opt input { position: absolute; opacity: 0; width: 0; height: 0; }
.scale4-dot {
  width: 26px; height: 26px;
  border-radius: 50%;
  border: 2px solid var(--dot-border);
  background: #fff;
  transition: border-color 0.12s, background 0.12s, box-shadow 0.12s, transform 0.12s;
}
.scale4-opt:hover .scale4-dot { border-color: var(--blue); transform: scale(1.08); }
.scale4-opt input:checked + .scale4-dot {
  background: var(--navy);
  border-color: var(--navy);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.scale4-opt input:focus-visible + .scale4-dot {
  outline: 3px solid var(--blue-light);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .scale4-row { grid-template-columns: 1fr; gap: 8px; }
  .scale4-radios { gap: 10px; }
}
```

- [ ] **Step 2: Create `quiz-data.js`**

Wrap the existing `CATS` (lines 719–780) and `BANDS` (783–788) arrays verbatim:

```js
// Shared question + scoring data for all quiz versions.
window.QUIZ_DATA = {
  // Each item is a [statement A (poor), statement B (rich)] pair.
  cats: /* PASTE the CATS array literal from index.html lines 719-780 here */,
  // Binary/4-scale score range 1.0–2.0. 1 = poor mindset, 2 = rich mindset.
  bands: /* PASTE the BANDS array literal from index.html lines 783-788 here */,
};
```
Concretely: set `cats:` to the array that currently follows `const CATS =` and `bands:` to the array that follows `const BANDS =`, keeping the comment above BANDS.

- [ ] **Step 3: Sanity-check the data file parses**

Run: `node -e "global.window={}; require('./quiz-data.js'); const d=window.QUIZ_DATA; let n=0; d.cats.forEach(c=>n+=c.items.length); console.log('cats',d.cats.length,'items',n,'bands',d.bands.length)"`
Expected: `cats 12 items 36 bands 4`

- [ ] **Step 4: Commit**

```bash
git add quiz.css quiz-data.js
git commit -m "refactor: extract quiz styles and data into shared files"
```

---

## Task 4: Build `quiz-core.js` and refactor `index.html` into a shell

The big one. Move all runtime logic into `quiz-core.js`, parameterized, with the binary mode renderer. Rewrite `index.html` as a shell. Baseline tests from Task 2 must still pass unchanged.

**Files:**
- Create: `quiz-core.js`
- Rewrite: `index.html`

- [ ] **Step 1: Create `quiz-core.js`**

```js
/* Shared quiz engine. Call window.initQuiz({ id, mode, cats, bands, introHtml }).
   - id: localStorage namespace -> rms_answers_<id>
   - mode: 'binary' | 'scale4'  (per-question input renderer)
   - cats/bands: from QUIZ_DATA
   - introHtml: the "how it works" paragraphs for this version
   All scoring/results code is mode-agnostic: answers are numbers in [1,2]. */
(function () {
  'use strict';

  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

  // ---- scale4 helpers (shared by renderer + labels) ----
  const SCALE4_LABELS = ['הכי קרוב לניסוח א׳', 'נוטה לניסוח א׳', 'נוטה לניסוח ב׳', 'הכי קרוב לניסוח ב׳'];
  function scale4Value(idx) { return +(1 + idx / 3).toFixed(4); } // 1, 1.3333, 1.6667, 2
  function scale4Index(value) { return Math.round((value - 1) * 3); }

  // ---- Mode renderers ----
  // Each mode: renderInput(key,pair,value,onPick)->element,
  //            markSelected(key,value), renderDetail(key,pair,value)->element,
  //            answerLabel(value)->string
  const MODES = {
    binary: {
      renderInput(key, pair, value, onPick) {
        const item = el('div', 'item'); item.id = `item_${key}`;
        const row = el('div', 'scale-row');

        const a = el('button', 'stmt right');
        a.type = 'button'; a.id = `stmt-a-${key}`;
        a.innerHTML = `<span class="stmt-label" aria-hidden="true">א׳</span>${pair[0]}`;
        a.setAttribute('aria-label', `ניסוח א׳: ${pair[0]}`);
        a.addEventListener('click', () => onPick(1));

        const b = el('button', 'stmt left');
        b.type = 'button'; b.id = `stmt-b-${key}`;
        b.innerHTML = `<span class="stmt-label" aria-hidden="true">ב׳</span>${pair[1]}`;
        b.setAttribute('aria-label', `ניסוח ב׳: ${pair[1]}`);
        b.addEventListener('click', () => onPick(2));

        row.appendChild(a); row.appendChild(b); item.appendChild(row);
        if (value !== undefined) {
          item.classList.add('answered');
          a.classList.toggle('selected', value === 1);
          b.classList.toggle('selected', value === 2);
        }
        return item;
      },
      markSelected(key, value) {
        document.getElementById(`stmt-a-${key}`).classList.toggle('selected', value === 1);
        document.getElementById(`stmt-b-${key}`).classList.toggle('selected', value === 2);
      },
      renderDetail(key, pair, value) {
        const item = el('div', 'item cat-item' + (value ? ' answered' : ''));
        const row = el('div', 'scale-row');
        const a = el('div', 'stmt right' + (value === 1 ? ' selected' : ''));
        a.innerHTML = `<span class="stmt-label" aria-hidden="true">א׳</span>${pair[0]}`;
        const b = el('div', 'stmt left' + (value === 2 ? ' selected' : ''));
        b.innerHTML = `<span class="stmt-label" aria-hidden="true">ב׳</span>${pair[1]}`;
        row.appendChild(a); row.appendChild(b); item.appendChild(row);
        return item;
      },
      answerLabel(value) { return `${['ניסוח א׳', 'ניסוח ב׳'][value - 1]} (${value})`; },
    },

    scale4: {
      renderInput(key, pair, value, onPick) {
        const item = el('fieldset', 'item scale4-item'); item.id = `item_${key}`;
        const legend = el('legend', 'sr-only');
        legend.textContent = `דרגו בין: ${pair[0]} (א׳) לבין ${pair[1]} (ב׳)`;
        item.appendChild(legend);

        const row = el('div', 'scale4-row');
        const aAnchor = el('div', 'scale4-anchor right');
        aAnchor.innerHTML = `<span class="stmt-label" aria-hidden="true">א׳</span>${pair[0]}`;

        const radios = el('div', 'scale4-radios');
        radios.setAttribute('role', 'radiogroup');
        radios.setAttribute('aria-label', `דרגו בין ${pair[0]} (א׳) לבין ${pair[1]} (ב׳)`);
        SCALE4_LABELS.forEach((lab, idx) => {
          const opt = el('label', 'scale4-opt');
          const input = document.createElement('input');
          input.type = 'radio'; input.name = `q_${key}`; input.value = String(idx);
          input.setAttribute('aria-label', lab);
          if (value !== undefined && scale4Index(value) === idx) input.checked = true;
          input.addEventListener('change', () => onPick(scale4Value(idx)));
          const dot = el('span', 'scale4-dot'); dot.setAttribute('aria-hidden', 'true');
          opt.appendChild(input); opt.appendChild(dot);
          radios.appendChild(opt);
        });

        const bAnchor = el('div', 'scale4-anchor left');
        bAnchor.innerHTML = `<span class="stmt-label" aria-hidden="true">ב׳</span>${pair[1]}`;

        row.appendChild(aAnchor); row.appendChild(radios); row.appendChild(bAnchor);
        item.appendChild(row);
        if (value !== undefined) item.classList.add('answered');
        return item;
      },
      markSelected() { /* native radio handles its own checked state */ },
      renderDetail(key, pair, value) {
        // Reuse the input renderer in a disabled, read-only form.
        const item = this.renderInput(`d_${key}`, pair, value, () => {});
        item.classList.add('cat-item');
        item.querySelectorAll('input').forEach(i => { i.disabled = true; });
        return item;
      },
      answerLabel(value) { return `${SCALE4_LABELS[scale4Index(value)]} (${value.toFixed(2)})`; },
    },
  };

  // ---- Shared skeleton (header + intro + quiz + results) ----
  function skeleton(introHtml) {
    return `
  <header class="site-header">
    <span class="eyebrow">כלי אבחון</span>
    <h1>שאלון מיפוי מיינדסט</h1>
    <p class="sub">עני מול עשיר — "The other side of the coin"</p>
  </header>

  <section id="intro" aria-labelledby="intro-heading">
    <div class="card intro-card">
      <h2 class="how-it-works" id="intro-heading">איך זה עובד?</h2>
      ${introHtml}
    </div>
    <div class="center" style="margin-top:10px;">
      <button class="btn" id="startBtn">בואו נתחיל ←</button>
    </div>
  </section>

  <section id="quiz" class="hidden" aria-label="שאלות השאלון">
    <div class="progress-wrap">
      <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="התקדמות השאלון" id="progressBar">
        <div class="progress-fill" id="pfill"></div>
      </div>
      <div class="progress-txt" id="ptxt">0 מתוך 0</div>
    </div>
    <div id="items"></div>
    <div class="center" style="margin-top:28px;">
      <button class="btn" id="showBtn" disabled aria-disabled="true">הצג את התוצאות שלי</button>
      <div class="note" id="remain"></div>
    </div>
  </section>

  <section id="results" class="hidden" aria-label="תוצאות השאלון">
    <div class="card">
      <div class="score-hero">
        <div class="score-num" id="totalNum" aria-live="polite">–</div>
        <div class="score-label" id="totalLabel"></div>
        <div class="score-sub">ציון כולל · 1 = מיינדסט עני &nbsp;·&nbsp; 2 = מיינדסט עשיר</div>
      </div>
    </div>
    <div class="card">
      <div class="legend-rev" aria-hidden="true">
        <span class="l">► ניסוח א׳ = מיינדסט עני</span>
        <span class="r">ניסוח ב׳ = מיינדסט עשיר ◄</span>
      </div>
      <div class="sort-bar" role="group" aria-label="מיון תוצאות">
        <span class="sort-label">מיון:</span>
        <button class="sort-btn active" id="sortDefault" data-sort="default" aria-pressed="true">לפי סדר</button>
        <button class="sort-btn" id="sortRich" data-sort="rich" aria-pressed="false">מיינדסט עשיר ↑</button>
        <button class="sort-btn" id="sortPoor" data-sort="poor" aria-pressed="false">מיינדסט עני ↑</button>
      </div>
      <p class="bd-hint">לחצו על קטגוריה כדי לראות את כל התשובות שבה ↓</p>
      <div id="breakdown" style="margin-top:18px;"></div>
    </div>
    <div class="card">
      <p class="chart-section-title">פרופיל המיינדסט שלך</p>
      <div class="chart-box">
        <canvas id="radar" role="img" aria-label="גרף מכ״מ של פרופיל המיינדסט לפי קטגוריות"></canvas>
      </div>
    </div>
    <div class="card answers-print" aria-label="פירוט התשובות">
      <p class="chart-section-title">פירוט התשובות שלך</p>
      <div id="answersDetail"></div>
    </div>
    <div class="card coaching-cta" style="text-align:center;">
      <p style="font-size:15px;font-weight:700;color:var(--navy);margin-bottom:8px;">לפגישה הבאה עם המאמן</p>
      <p style="font-size:14px;color:var(--ink-2);line-height:1.7;margin-bottom:16px;">שמרו או הדפיסו את הדף והביאו אותו לפגישה. התמקדו במיוחד בקטגוריות עם הציון הנמוך ביותר, שם הפוטנציאל הגדול ביותר לצמיחה.</p>
      <button class="btn" id="printBtn" style="margin-left:10px;">הדפסה / שמירה כ-PDF</button>
    </div>
    <div class="center" style="margin-top:8px;">
      <button class="btn ghost" id="restartBtn">מילוי מחדש</button>
    </div>
    <p class="results-tip">טיפ: התמקדו בקטגוריות עם הציון הנמוך ביותר. שם הפוטנציאל הגדול ביותר לצמיחה.</p>
  </section>`;
  }

  // ---- Engine ----
  function initQuiz(config) {
    const mode = MODES[config.mode];
    const CATS = config.cats;
    const BANDS = config.bands;
    const STORAGE_KEY = `rms_answers_${config.id}`;
    const mount = document.getElementById('app');
    mount.innerHTML = skeleton(config.introHtml);

    let answers = {};
    let totalItems = 0; CATS.forEach(c => totalItems += c.items.length);
    let radarChart = null, lastCatAvgs = [], sortMode = 'default';

    const bandFor = v => BANDS.find(b => v <= b.max);

    function start() {
      try { const s = localStorage.getItem(STORAGE_KEY); if (s) answers = JSON.parse(s); } catch (e) {}
      document.getElementById('intro').classList.add('hidden');
      document.getElementById('quiz').classList.remove('hidden');
      buildQuiz();
      window.scrollTo(0, 0);
    }

    function buildQuiz() {
      const box = document.getElementById('items');
      box.innerHTML = '';
      CATS.forEach((cat, ci) => {
        const section = el('section');
        section.setAttribute('aria-labelledby', `cat-heading-${ci}`);
        const h2 = el('h2', 'cat-title'); h2.id = `cat-heading-${ci}`;
        h2.innerHTML = `<span class="cat-num" aria-hidden="true">${ci + 1}</span>${cat.name}`;
        section.appendChild(h2);
        cat.items.forEach((pair, ii) => {
          const key = `${ci}_${ii}`;
          section.appendChild(mode.renderInput(key, pair, answers[key], v => pick(key, v)));
        });
        box.appendChild(section);
      });
      updateProgress();
    }

    function pick(key, v) {
      answers[key] = v;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(answers)); } catch (e) {}
      document.getElementById(`item_${key}`).classList.add('answered');
      mode.markSelected(key, v);
      updateProgress();
    }

    function updateProgress() {
      const done = Object.keys(answers).length;
      const pct = Math.round(done / totalItems * 100);
      document.getElementById('pfill').style.transform = `scaleX(${pct / 100})`;
      document.getElementById('progressBar').setAttribute('aria-valuenow', pct);
      document.getElementById('ptxt').textContent = `${done} מתוך ${totalItems} (${pct}%)`;
      const btn = document.getElementById('showBtn');
      const remain = document.getElementById('remain');
      btn.disabled = done < totalItems;
      btn.setAttribute('aria-disabled', done < totalItems ? 'true' : 'false');
      if (done < totalItems) {
        remain.textContent = `נותרו ${totalItems - done} שאלות למילוי`;
        remain.className = 'note';
      } else {
        remain.textContent = 'מילאת הכול! אפשר לראות תוצאות.';
        remain.className = 'note complete';
      }
    }

    function showResults() {
      const catAvgs = [];
      let all = [];
      CATS.forEach((cat, ci) => {
        const vals = cat.items.map((_, ii) => answers[`${ci}_${ii}`]).filter(v => v !== undefined);
        all = all.concat(vals);
        catAvgs.push(+(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
      });
      const total = +(all.reduce((a, b) => a + b, 0) / all.length).toFixed(2);
      document.getElementById('quiz').classList.add('hidden');
      document.getElementById('results').classList.remove('hidden');
      const band = bandFor(total);
      const tn = document.getElementById('totalNum');
      tn.textContent = total.toFixed(1).replace('.0', '');
      tn.style.color = band.color;
      document.getElementById('totalLabel').textContent = band.label;
      document.getElementById('totalLabel').style.color = band.color;
      lastCatAvgs = catAvgs;
      renderBreakdown();
      renderAnswers();
      drawRadar(catAvgs);
      window.scrollTo(0, 0);
    }

    function renderAnswers() {
      const box = document.getElementById('answersDetail');
      box.innerHTML = '';
      CATS.forEach((cat, ci) => {
        const h = el('h3', 'ans-cat'); h.textContent = `${ci + 1}. ${cat.name}`;
        box.appendChild(h);
        cat.items.forEach((pair, ii) => {
          const v = answers[`${ci}_${ii}`];
          const row = el('div', 'ans-row');
          const stmts = el('div', 'ans-stmts');
          const sa = el('span'); sa.textContent = `א׳: ${pair[0]}`;
          const sb = el('span'); sb.textContent = `ב׳: ${pair[1]}`;
          stmts.appendChild(sa); stmts.appendChild(sb);
          const pickEl = el('div', 'ans-pick');
          pickEl.textContent = (v !== undefined) ? `תשובה: ${mode.answerLabel(v)}` : 'תשובה: לא נענה';
          row.appendChild(stmts); row.appendChild(pickEl);
          box.appendChild(row);
        });
      });
    }

    function setSortMode(m) {
      sortMode = m;
      ['default', 'rich', 'poor'].forEach(x => {
        const btn = document.getElementById('sort' + x[0].toUpperCase() + x.slice(1));
        btn.classList.toggle('active', x === m);
        btn.setAttribute('aria-pressed', x === m ? 'true' : 'false');
      });
      renderBreakdown();
    }

    function renderBreakdown() {
      const bd = document.getElementById('breakdown');
      bd.innerHTML = '';
      let items = CATS.map((cat, ci) => ({ cat, ci, v: lastCatAvgs[ci] }));
      if (sortMode === 'rich') items.sort((a, b) => b.v - a.v);
      else if (sortMode === 'poor') items.sort((a, b) => a.v - b.v);
      items.forEach(({ cat, ci, v }) => {
        const band = bandFor(v);
        const detailId = `catDetail_${ci}`;
        const row = el('div', 'res-row');
        const head = el('button', 'res-head');
        head.type = 'button';
        head.setAttribute('aria-expanded', 'false');
        head.setAttribute('aria-controls', detailId);
        head.innerHTML =
          `<span class="res-chevron" aria-hidden="true"></span>
           <span class="res-headtext">
             <span class="res-name">${ci + 1}. ${cat.name}</span>
             <span class="res-val" style="color:${band.color};background:${band.bg};">${v.toFixed(2)} · ${band.label}</span>
           </span>`;
        const track = el('div', 'track');
        track.setAttribute('aria-hidden', 'true');
        track.innerHTML = `<div class="marker" style="right:calc(${((v - 1) * 100)}% - 2px)"></div>`;
        const detail = el('div', 'cat-detail hidden'); detail.id = detailId;
        cat.items.forEach((pair, ii) => {
          detail.appendChild(mode.renderDetail(`${ci}_${ii}`, pair, answers[`${ci}_${ii}`]));
        });
        head.addEventListener('click', () => {
          const open = detail.classList.toggle('hidden') === false;
          head.setAttribute('aria-expanded', open ? 'true' : 'false');
          row.classList.toggle('open', open);
        });
        row.appendChild(head); row.appendChild(track); row.appendChild(detail);
        bd.appendChild(row);
      });
    }

    function drawRadar(vals) {
      const ctx = document.getElementById('radar');
      if (typeof Chart === 'undefined') {
        ctx.parentElement.innerHTML = '<p style="color:var(--muted);font-size:14px;text-align:center;padding:20px">גרף המכ״מ אינו זמין. בדוק את חיבור האינטרנט ורענן.</p>';
        return;
      }
      if (radarChart) radarChart.destroy();
      radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: CATS.map(c => c.name.length > 12 ? c.name.match(/.{1,12}(\s|$)/g).map(s => s.trim()) : c.name),
          datasets: [{
            label: 'הציון שלי', data: vals, fill: true,
            backgroundColor: 'rgba(46,84,150,0.13)', borderColor: '#2e5496', borderWidth: 2,
            pointBackgroundColor: '#1f3864', pointBorderColor: '#fff', pointBorderWidth: 2,
            pointRadius: 4, pointHoverRadius: 6,
          }]
        },
        options: {
          responsive: true,
          scales: { r: { min: 1, max: 2, ticks: { stepSize: 0.25, backdropColor: 'transparent', font: { size: 11 } },
            pointLabels: { font: { size: 10, weight: '600' } }, grid: { color: 'rgba(31,56,100,0.08)' }, angleLines: { color: 'rgba(31,56,100,0.08)' } } },
          plugins: { legend: { display: false }, tooltip: { callbacks: { title: it => CATS[it[0].dataIndex].name, label: it => 'ציון: ' + it.raw } } }
        }
      });
    }

    function restart() {
      answers = {};
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      document.getElementById('results').classList.add('hidden');
      document.getElementById('intro').classList.remove('hidden');
      window.scrollTo(0, 0);
    }

    // Wire controls (replaces inline onclick handlers from the monolith).
    document.getElementById('startBtn').addEventListener('click', start);
    document.getElementById('showBtn').addEventListener('click', showResults);
    document.getElementById('printBtn').addEventListener('click', () => window.print());
    document.getElementById('restartBtn').addEventListener('click', restart);
    document.querySelectorAll('.sort-btn').forEach(b =>
      b.addEventListener('click', () => setSortMode(b.dataset.sort)));
  }

  window.initQuiz = initQuiz;
})();
```

- [ ] **Step 2: Rewrite `index.html` as a thin shell**

Replace the ENTIRE contents of `index.html` with:

```html
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>שאלון מיפוי מיינדסט — עני מול עשיר</title>
<link rel="stylesheet" href="quiz.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js" crossorigin="anonymous"></script>
</head>
<body>
<main id="app"></main>
<script src="quiz-data.js"></script>
<script src="quiz-core.js"></script>
<script>
  initQuiz({
    id: 'binary',
    mode: 'binary',
    cats: QUIZ_DATA.cats,
    bands: QUIZ_DATA.bands,
    introHtml: `
      <p>בכל שורה מוצגים שני ניסוחים מנוגדים: <span class="pill">ניסוח א׳</span> מימין, <span class="pill">ניסוח ב׳</span> משמאל.</p>
      <p>אין נקודת אמצע — בחרו את הניסוח האחד שמתאר אתכם יותר. חייבים לבחור צד.</p>
      <p>השאלון מנוסח <strong>נייטרלי בכוונה</strong>: אין כאן צד "טוב" או "רע". ענו בכנות לאן אתם נוטים. המשמעות של כל צד תתגלה רק בסוף, במסך התוצאות.</p>`,
  });
</script>
</body>
</html>
```

- [ ] **Step 3: Run the baseline regression — expect PASS (unchanged behavior)**

Run: `npm test -- tests/binary.spec.js`
Expected: 3 passed. The refactor preserves DOM ids, classes, 36 items, two buttons each, `0_0 → 1` on click, and total in `[1,2]`.

Note: the localStorage key changed from `rms_answers` to `rms_answers_binary`. The baseline test from Task 2 reads `rms_answers` in one assertion — update that line now to `rms_answers_binary`:

In `tests/binary.spec.js`, change:
```js
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rms_answers') || '{}'));
```
to:
```js
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rms_answers_binary') || '{}'));
```
Then re-run `npm test -- tests/binary.spec.js` → 3 passed.

- [ ] **Step 4: Commit**

```bash
git add quiz-core.js index.html tests/binary.spec.js
git commit -m "refactor: move quiz logic to shared core; index.html is a thin shell"
```

---

## Task 5: Add the scale4 version page

The scale4 renderer already exists in `quiz-core.js` (Task 4). This task adds the page and its tests.

**Files:**
- Create: `scale4.html`
- Create: `tests/scale4.spec.js`

- [ ] **Step 1: Write `tests/scale4.spec.js` (failing — page doesn't exist yet)**

```js
const { test, expect } = require('@playwright/test');
const { TOTAL_ITEMS, answerAll, startQuiz } = require('./helpers');

test('renders exactly 4 radios per question, no neutral middle', async ({ page }) => {
  await startQuiz(page, '/scale4.html');
  await expect(page.locator('#items .scale4-item')).toHaveCount(TOTAL_ITEMS);
  await expect(page.locator('#items input[type="radio"]')).toHaveCount(TOTAL_ITEMS * 4);
  // First question's group has 4 options (even count => no neutral middle option).
  await expect(page.locator('#items .scale4-radios').first().locator('input')).toHaveCount(4);
});

test('selecting the strong-A radio stores 1.0; strong-B stores 2.0', async ({ page }) => {
  await startQuiz(page, '/scale4.html');
  const firstGroup = page.locator('#items .scale4-radios').first().locator('input');
  await firstGroup.nth(0).check();
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rms_answers_scale4'))['0_0']);
  expect(stored).toBeCloseTo(1.0, 3);
  await firstGroup.nth(3).check();
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rms_answers_scale4'))['0_0']);
  expect(stored).toBeCloseTo(2.0, 3);
});

test('answering all enables results; total in [1,2]; radar renders', async ({ page }) => {
  await startQuiz(page, '/scale4.html');
  await answerAll(page, 'scale4');
  await page.locator('#showBtn').click();
  await expect(page.locator('#results')).toBeVisible();
  const total = parseFloat(await page.locator('#totalNum').textContent());
  expect(total).toBeGreaterThanOrEqual(1);
  expect(total).toBeLessThanOrEqual(2);
  await expect(page.locator('#radar')).toBeVisible();
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- tests/scale4.spec.js`
Expected: FAIL (navigation to `/scale4.html` 404s / elements not found).

- [ ] **Step 3: Create `scale4.html`**

```html
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>שאלון מיפוי מיינדסט — סולם 4 דרגות</title>
<link rel="stylesheet" href="quiz.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js" crossorigin="anonymous"></script>
</head>
<body>
<main id="app"></main>
<script src="quiz-data.js"></script>
<script src="quiz-core.js"></script>
<script>
  initQuiz({
    id: 'scale4',
    mode: 'scale4',
    cats: QUIZ_DATA.cats,
    bands: QUIZ_DATA.bands,
    introHtml: `
      <p>בכל שורה מוצגים שני ניסוחים מנוגדים: <span class="pill">ניסוח א׳</span> מימין, <span class="pill">ניסוח ב׳</span> משמאל.</p>
      <p>בחרו את אחת מ-<strong>ארבע הדרגות</strong> שביניהם — מ"הכי קרוב לניסוח א׳" ועד "הכי קרוב לניסוח ב׳". אין נקודת אמצע — חייבים לבחור צד.</p>
      <p>השאלון מנוסח <strong>נייטרלי בכוונה</strong>: אין כאן צד "טוב" או "רע". ענו בכנות לאן אתם נוטים. המשמעות של כל צד תתגלה רק בסוף, במסך התוצאות.</p>`,
  });
</script>
</body>
</html>
```

- [ ] **Step 4: Run scale4 tests — expect PASS**

Run: `npm test -- tests/scale4.spec.js`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add scale4.html tests/scale4.spec.js
git commit -m "feat: add 4-radio scale version (scale4.html)"
```

---

## Task 6: Landing page

**Files:**
- Create: `versions.html`
- Create: `tests/landing.spec.js`

- [ ] **Step 1: Write `tests/landing.spec.js` (failing)**

```js
const { test, expect } = require('@playwright/test');

test('landing page links to both versions', async ({ page }) => {
  await page.goto('/versions.html');
  const binaryLink = page.locator('a[href="index.html"]');
  const scale4Link = page.locator('a[href="scale4.html"]');
  await expect(binaryLink).toBeVisible();
  await expect(scale4Link).toBeVisible();

  await binaryLink.click();
  await expect(page).toHaveURL(/index\.html$/);
  await expect(page.locator('#intro')).toBeVisible();
});

test('scale4 link resolves to the 4-radio version', async ({ page }) => {
  await page.goto('/versions.html');
  await page.locator('a[href="scale4.html"]').click();
  await expect(page).toHaveURL(/scale4\.html$/);
  await expect(page.locator('#intro')).toBeVisible();
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- tests/landing.spec.js`
Expected: FAIL (404 on `/versions.html`).

- [ ] **Step 3: Create `versions.html`**

```html
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>שאלון מיפוי מיינדסט — בחירת גרסה</title>
<link rel="stylesheet" href="quiz.css">
<style>
  .versions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
  @media (max-width: 640px) { .versions-grid { grid-template-columns: 1fr; } }
  .version-card {
    display: block; text-decoration: none; color: inherit;
    background: var(--card); border: 1.5px solid var(--line); border-radius: 18px;
    padding: 26px; box-shadow: 0 1px 3px rgba(20,35,60,0.06), 0 4px 16px rgba(20,35,60,0.05);
    transition: border-color 0.15s, transform 0.12s, box-shadow 0.15s;
  }
  .version-card:hover { border-color: var(--blue-light); transform: translateY(-2px); box-shadow: 0 6px 22px rgba(20,35,60,0.1); }
  .version-card:focus-visible { outline: 3px solid var(--blue-light); outline-offset: 3px; }
  .version-card h2 { font-size: 18px; color: var(--navy); font-weight: 800; margin-bottom: 8px; }
  .version-card p { font-size: 14px; color: var(--ink-2); line-height: 1.7; }
  .version-card .go { display: inline-block; margin-top: 14px; font-weight: 700; color: var(--blue); }
</style>
</head>
<body>
<main>
  <header class="site-header">
    <span class="eyebrow">כלי אבחון</span>
    <h1>שאלון מיפוי מיינדסט</h1>
    <p class="sub">בחרו גרסה למילוי</p>
  </header>
  <div class="versions-grid">
    <a class="version-card" href="index.html">
      <h2>גרסה א׳ — בחירה בין שני ניסוחים</h2>
      <p>בכל שאלה בוחרים את אחד משני הניסוחים המנוגדים. מהיר וחד.</p>
      <span class="go">למילוי גרסה א׳ ←</span>
    </a>
    <a class="version-card" href="scale4.html">
      <h2>גרסה ב׳ — סולם בן 4 דרגות</h2>
      <p>בכל שאלה מדרגים על סולם בן ארבע דרגות בין שני הניסוחים. מדויק יותר.</p>
      <span class="go">למילוי גרסה ב׳ ←</span>
    </a>
  </div>
</main>
</body>
</html>
```

- [ ] **Step 4: Run landing tests — expect PASS**

Run: `npm test -- tests/landing.spec.js`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add versions.html tests/landing.spec.js
git commit -m "feat: add versions landing page"
```

---

## Task 7: Cross-version results, isolation, and a11y tests

**Files:**
- Create: `tests/results.spec.js`
- Create: `tests/isolation.spec.js`
- Create: `tests/a11y.spec.js`

- [ ] **Step 1: Write `tests/results.spec.js`**

```js
const { test, expect } = require('@playwright/test');
const { TOTAL_CATS, answerAll, startQuiz } = require('./helpers');

// Answering all strong-A (binary stmt-A == scale4 idx0) yields the minimum
// score 1.0 in BOTH versions — proving the score scales are comparable.
test('binary all-A gives total 1.0', async ({ page }) => {
  await startQuiz(page, '/index.html');
  await answerAll(page, 'binary'); // helper clicks stmt.right (A)
  await page.locator('#showBtn').click();
  expect(parseFloat(await page.locator('#totalNum').textContent())).toBeCloseTo(1.0, 2);
});

test('scale4 all-strong-A gives total 1.0', async ({ page }) => {
  await startQuiz(page, '/scale4.html');
  await answerAll(page, 'scale4'); // helper checks idx0 (strong A)
  await page.locator('#showBtn').click();
  expect(parseFloat(await page.locator('#totalNum').textContent())).toBeCloseTo(1.0, 2);
});

test('breakdown shows all categories and they expand', async ({ page }) => {
  await startQuiz(page, '/index.html');
  await answerAll(page, 'binary');
  await page.locator('#showBtn').click();
  await expect(page.locator('#breakdown .res-row')).toHaveCount(TOTAL_CATS);
  const firstHead = page.locator('#breakdown .res-head').first();
  await firstHead.click();
  await expect(firstHead).toHaveAttribute('aria-expanded', 'true');
});
```

- [ ] **Step 2: Write `tests/isolation.spec.js`**

```js
const { test, expect } = require('@playwright/test');
const { answerAll, startQuiz } = require('./helpers');

test('binary and scale4 use separate storage keys', async ({ page }) => {
  await startQuiz(page, '/index.html');
  await page.locator('#items .stmt.right').first().click();
  await startQuiz(page, '/scale4.html');
  await page.locator('#items .scale4-radios').first().locator('input').nth(3).check();

  const keys = await page.evaluate(() => ({
    binary: localStorage.getItem('rms_answers_binary'),
    scale4: localStorage.getItem('rms_answers_scale4'),
  }));
  expect(JSON.parse(keys.binary)['0_0']).toBe(1);          // binary untouched
  expect(JSON.parse(keys.scale4)['0_0']).toBeCloseTo(2.0, 3); // scale4 independent
});
```

- [ ] **Step 3: Write `tests/a11y.spec.js`**

```js
const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const { startQuiz } = require('./helpers');

for (const [name, path] of [['binary', '/index.html'], ['scale4', '/scale4.html'], ['landing', '/versions.html']]) {
  test(`${name} intro has no serious/critical a11y violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter(v => ['serious', 'critical'].includes(v.impact));
    expect(serious, JSON.stringify(serious.map(v => v.id), null, 2)).toEqual([]);
  });
}

for (const [name, path] of [['binary', '/index.html'], ['scale4', '/scale4.html']]) {
  test(`${name} quiz form has no serious/critical a11y violations`, async ({ page }) => {
    await startQuiz(page, path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter(v => ['serious', 'critical'].includes(v.impact));
    expect(serious, JSON.stringify(serious.map(v => v.id), null, 2)).toEqual([]);
  });
}
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all specs pass (binary 3, scale4 3, results 3, isolation 1, landing 2, a11y 5). If an a11y violation surfaces (e.g. contrast on a `.scale4-dot`), fix the CSS/markup in `quiz.css`/`quiz-core.js` and re-run until clean.

- [ ] **Step 5: Commit**

```bash
git add tests/results.spec.js tests/isolation.spec.js tests/a11y.spec.js
git commit -m "test: cross-version results, storage isolation, and a11y specs"
```

---

## Task 8: Final verification and PR

- [ ] **Step 1: Full suite green**

Run: `npm test`
Expected: 0 failures.

- [ ] **Step 2: Manual smoke (optional, if preview available)**

From a session rooted in this repo, `preview_start` → open `/versions.html`, click into each version, answer a few, view results. Confirms visuals.

- [ ] **Step 3: Push and open the PR**

```bash
GITHUB_TOKEN= gh auth switch --user achisolomon
git push -u origin survey-versions
gh pr create --title "Add 4-radio survey version + shared core + landing page" \
  --body "Two quiz versions (binary + 4-radio) on a shared core (quiz.css/quiz-data.js/quiz-core.js), a versions landing page, and a Playwright test suite. Spec: docs/superpowers/specs/2026-06-25-survey-versions-design.md. Plan: docs/superpowers/plans/2026-06-25-survey-versions.md."
```
Expected: PR created against `main`.

---

## Notes for the implementer

- **RTL is first-class.** Statement א׳ is on the right, ב׳ on the left, in both modes. The scale4 radio order in DOM is idx 0→3 (strong-A → strong-B); under `dir="rtl"` idx 0 renders rightmost, next to anchor א׳. Don't "fix" the order.
- **Score mapping is the contract.** scale4 stores `1 + idx/3` (1.0, 1.333, 1.667, 2.0). Never normalize elsewhere — every results function assumes numbers in `[1,2]`.
- **Don't touch `build_quiz*.py`.** They're legacy data generators; `quiz-data.js` is now the source of truth.
- **`index.html` must stay behavior-identical to main.** The Task 2 baseline is the guard — if it fails after Task 4, the refactor diverged.
