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

        // Native radios share name=`q_${key}` and sit inside the fieldset/legend,
        // which already groups and labels them — no extra ARIA radiogroup needed.
        const radios = el('div', 'scale4-radios');
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
        catAvgs.push(vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 1.5);
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
        const btn = document.querySelector(`.sort-btn[data-sort="${x}"]`);
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
