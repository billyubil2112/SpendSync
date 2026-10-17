'use strict';

/* ============================================================
   SpendSync — UI layer.
   Data & pure logic live in state.js (globals: state, helpers).
   ============================================================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const RATE_EMOJIS = ['', '😭', '😕', '😐', '🙂', '🥰'];
const RATE_LABELS = ['', 'regret', 'meh', 'eh, ok', 'worth it', 'loved it'];

let view = 'home';
let dashMonth = monthKey(today());
let homeView = localStorage.getItem('ss_view') || 'pace';
let period = 'day';
let fundPotId = null;
let lastDeleted = null;
let lastDeletedType = null;
let pieChart = null;
let barChart = null;
let sheetChart = null;
let soundOn = localStorage.getItem('ss_sound') !== 'off';
let audioCtx = null;

/* ============================== SOUND ============================== */

function ensureCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function tone(freq, dur, type, delay, vol) {
  if (!soundOn || !audioCtx) return;
  const t = audioCtx.currentTime + (delay || 0);
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type || 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.18, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

const sfx = {
  click() { ensureCtx(); tone(620, 0.06, 'triangle', 0, 0.08); },
  open() { ensureCtx(); tone(440, 0.07, 'sine', 0, 0.1); tone(660, 0.07, 'sine', 0.05, 0.1); },
  success() { ensureCtx(); tone(523, 0.12, 'sine', 0); tone(659, 0.12, 'sine', 0.1); tone(784, 0.22, 'sine', 0.2); },
  error() { ensureCtx(); tone(200, 0.2, 'sawtooth', 0, 0.12); },
  coin() { ensureCtx(); tone(880, 0.09, 'square', 0, 0.1); tone(1175, 0.18, 'square', 0.08, 0.1); }
};

function updateSoundBtn() {
  $('#sound-btn').textContent = soundOn ? '🔊' : '🔇';
  $('#sound-btn-top').textContent = soundOn ? '🔊' : '🔇';
}

function toggleSound() {
  soundOn = !soundOn;
  localStorage.setItem('ss_sound', soundOn ? 'on' : 'off');
  updateSoundBtn();
  if (soundOn) sfx.success();
}

/* ============================== CONFETTI ============================== */

function burst(scale) {
  if (typeof confetti !== 'function') return;
  confetti({
    particleCount: 90 * (scale || 1),
    spread: 75,
    startVelocity: 42,
    origin: { x: 0.5, y: 0.7 },
    colors: ['#c9971f', '#8a8a82', '#2e8b57', '#c4503d', '#191917']
  });
}

/* ============================== TOASTS ============================== */

function toast(msg, emoji) {
  const wrap = $('#toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${emoji || '✨'}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 350);
  }, 2600);
}

function toastUndo() {
  const wrap = $('#toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.cursor = 'pointer';
  el.innerHTML = '<span>🗑️</span><span>Deleted</span><button class="ghost-btn small" id="undo-btn">Undo</button>';
  wrap.appendChild(el);
  $('#undo-btn').addEventListener('click', () => {
    if (lastDeletedType === 'expense') state.expenses = [lastDeleted, ...state.expenses];
    else if (lastDeletedType === 'pot') state.pots = [lastDeleted, ...state.pots];
    else if (lastDeletedType === 'income') state.incomes = [...state.incomes, lastDeleted];
    lastDeleted = null;
    lastDeletedType = null;
    el.remove();
    saveData();
    renderAll();
    sfx.success();
    toast('Restored!', '↩️');
  });
  setTimeout(() => el.remove(), 5000);
}

/* ============================== CAT SVG ============================== */

function catSVG(lv, mood) {
  const boss = lv >= 4;
  const adult = lv >= 2;
  const fur = boss ? '#f5a742' : adult ? '#f4a23c' : '#f6b25a';
  const dark = '#3c2a1e';
  const inner = '#ffd9c0';
  const eyeY = mood === 'grumpy' ? 84 : 82;
  const eyes = mood === 'happy'
    ? `<circle cx="80" cy="${eyeY}" r="7" fill="${dark}"/><circle cx="120" cy="${eyeY}" r="7" fill="${dark}"/><circle cx="82.5" cy="${eyeY - 2}" r="2.2" fill="#fff"/><circle cx="122.5" cy="${eyeY - 2}" r="2.2" fill="#fff"/>`
    : `<circle cx="80" cy="${eyeY}" r="9" fill="${dark}"/><circle cx="120" cy="${eyeY}" r="9" fill="${dark}" opacity="0.35"/><circle cx="82.5" cy="${eyeY - 2.5}" r="2.6" fill="#fff"/>`;
  const bangs = mood === 'grumpy'
    ? `<path d="M70 71 L92 79" stroke="${dark}" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M130 71 L108 79" stroke="${dark}" stroke-width="4" stroke-linecap="round" fill="none"/>` : '';
  const mouth = mood === 'happy'
    ? `<path d="M94 106 Q100 114 106 106" stroke="${dark}" stroke-width="4" stroke-linecap="round" fill="none"/>`
    : mood === 'worried'
      ? `<ellipse cx="100" cy="109" rx="4" ry="5.5" fill="${dark}"/>`
      : `<path d="M92 112 Q100 104 108 112" stroke="${dark}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
  const sweat = mood === 'worried'
    ? `<path d="M143 66 q6 8 0 12 q-7 -4 0 -12" fill="#7fc8ff" opacity="0.9"/>` : '';
  const whiskers = `<g stroke="${dark}" stroke-width="2.5" opacity="0.5" stroke-linecap="round">
    <path d="M62 96 L38 92"/><path d="M62 102 L40 104"/><path d="M138 96 L162 92"/><path d="M138 102 L160 104"/></g>`;
  const blush = `<g fill="rgba(232,80,58,0.28)"><ellipse cx="62" cy="99" rx="7" ry="4.5"/><ellipse cx="138" cy="99" rx="7" ry="4.5"/></g>`;
  const happyEyes = `<g stroke="${dark}" stroke-width="4.5" stroke-linecap="round" fill="none"><path d="M72 ${eyeY} q8 -9 16 0"/><path d="M112 ${eyeY} q8 -9 16 0"/></g>`;
  const happyMouth = `<g><path d="M90 103 q10 12 20 0" stroke="${dark}" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M94 108 q6 6 12 0 q-1 3.5 -6 3.5 q-5 0 -6 -3.5" fill="#ff8a9e"/></g>`;
  const collar = boss
    ? `<rect x="66" y="${adult ? 132 : 122}" width="68" height="14" rx="7" fill="#e8503a"/><circle cx="100" cy="${adult ? 139 : 129}" r="8" fill="#ffd166"/><circle cx="100" cy="${adult ? 139 : 129}" r="3.4" fill="#e8a20a"/>`
    : `<rect x="70" y="${adult ? 134 : 124}" width="60" height="12" rx="6" fill="#e8503a" opacity="0.9"/>`;
  const crown = boss ? `<g><path d="M84 34 L88 48 L72 46 Z M116 34 L112 48 L128 46 Z" fill="#e8503a"/>
    <path d="M78 46 L92 32 L100 44 L108 32 L122 46 L110 52 L90 52 Z" fill="#ffd166" stroke="#e8a20a" stroke-width="1.5"/>
    <circle cx="100" cy="38" r="3.6" fill="#fff"/><circle cx="84" cy="40" r="2.4" fill="#fff"/><circle cx="116" cy="40" r="2.4" fill="#fff"/></g>` : '';
  const star = (x, y, r) => `<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z" fill="#ffd166"/>`;
  const sparkles = boss ? `${star(152, 44, 7)}${star(46, 54, 5)}${star(160, 92, 4.5)}` : '';
  const tail = `<g class="cat-tail"><path d="M${boss ? 62 : 66} ${adult ? 138 : 120} C 28 ${adult ? 150 : 132}, 20 ${adult ? 116 : 106}, 40 ${adult ? 108 : 102} C 46 ${adult ? 105 : 100}, 50 ${adult ? 112 : 108}, 46 ${adult ? 114 : 110}" stroke="${fur}" stroke-width="13" fill="none" stroke-linecap="round"/></g>`;
  const ear = `<path d="M78 ${adult ? 52 : 58} L66 ${adult ? 18 : 26} L98 ${adult ? 36 : 46} Z" fill="${fur}"/><path d="M120 ${adult ? 52 : 58} L134 ${adult ? 18 : 26} L102 ${adult ? 36 : 46} Z" fill="${fur}"/><path d="M79 ${adult ? 50 : 56} L71 ${adult ? 28 : 34} L94 ${adult ? 41 : 48} Z" fill="${inner}"/><path d="M121 ${adult ? 50 : 56} L129 ${adult ? 28 : 34} L106 ${adult ? 41 : 48} Z" fill="${inner}"/>`;
  const body = `<ellipse cx="100" cy="${adult ? 158 : 142}" rx="${adult ? 52 : 42}" ry="${adult ? 46 : 37}" fill="${fur}"/>`;
  const paws = `<ellipse cx="76" cy="${adult ? 182 : 160}" rx="11" ry="7" fill="${fur}"/><ellipse cx="124" cy="${adult ? 182 : 160}" rx="11" ry="7" fill="${fur}"/><path d="M76 ${adult ? 168 : 150} q-4 ${adult ? 9 : 8} 0 ${adult ? 14 : 12}" stroke="${dark}" stroke-width="2.5" fill="none" opacity="0.35"/><path d="M124 ${adult ? 168 : 150} q4 ${adult ? 9 : 8} 0 ${adult ? 14 : 12}" stroke="${dark}" stroke-width="2.5" fill="none" opacity="0.35"/>`;
  const headY = adult ? 82 : 88;
  const head = `<circle cx="100" cy="${headY}" r="46" fill="${fur}"/>`;
  return `<svg viewBox="0 0 200 204" xmlns="http://www.w3.org/2000/svg">
  ${sparkles}${crown}${tail}${body}${paws}<g>${ear}${head}${whiskers}${blush}${collar}<g class="cat-face-normal">${eyes}${bangs}${mouth}${sweat}</g><g class="cat-face-happy">${happyEyes}${happyMouth}</g></g>
  <ellipse cx="138" cy="26" rx="2.6" ry="5" fill="${inner}" transform="rotate(-28 138 26)" opacity="0.65"/></svg>`;
}

const MEOWS = ['Meow!', 'Purr purr…', 'Mrow~', 'Prrr!', 'Nyaa~', 'Meow meow!', 'Purrrr 🐾'];

// Randomized "petted" reaction: trick spin, particles, mini confetti at the cat.
function petReaction(svgEl) {
  svgEl.classList.remove('petted', 'petted-flip', 'petted-bounce');
  void svgEl.offsetWidth;
  const tricks = ['petted-flip', 'petted-bounce', 'petted'];
  svgEl.classList.add(tricks[Math.floor(Math.random() * tricks.length)]);
  if (svgEl._pettedTimer) clearTimeout(svgEl._pettedTimer);
  svgEl._pettedTimer = setTimeout(() => {
    svgEl.classList.remove('petted', 'petted-flip', 'petted-bounce');
  }, 1200);

  // Host particles on the row so re-rendering the svg doesn't wipe them.
  const host = svgEl.parentElement && svgEl.parentElement.classList.contains('cat-row')
    ? svgEl.parentElement
    : svgEl;

  // Purr ring
  const ring = document.createElement('span');
  ring.className = 'pet-ring';
  host.appendChild(ring);
  setTimeout(() => ring.remove(), 900);

  // Particles: hearts up, stars flying out
  const hearts = ['❤️', '💛', '🐟', '⭐'];
  for (let i = 0; i < 4; i++) {
    const h = document.createElement('span');
    h.className = 'pet-heart';
    h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    h.style.left = 15 + Math.random() * 65 + '%';
    h.style.bottom = 20 + Math.random() * 35 + '%';
    h.style.animationDelay = Math.random() * 0.25 + 's';
    h.style.fontSize = 0.7 + Math.random() * 0.8 + 'rem';
    host.appendChild(h);
    setTimeout(() => h.remove(), 1600);
  }
  for (let i = 0; i < 5; i++) {
    const s = document.createElement('span');
    s.className = 'pet-star';
    s.style.left = 40 + Math.random() * 20 + '%';
    s.style.top = 30 + Math.random() * 30 + '%';
    s.style.setProperty('--sx', (Math.random() * 90 - 45) + 'px');
    s.style.setProperty('--sy', (-20 - Math.random() * 60) + 'px');
    s.style.animationDelay = Math.random() * 0.2 + 's';
    host.appendChild(s);
    setTimeout(() => s.remove(), 1300);
  }

  // Mini confetti at the cat's position
  if (typeof confetti === 'function') {
    const rect = svgEl.getBoundingClientRect();
    confetti({
      particleCount: 24,
      spread: 55,
      startVelocity: 26,
      scalar: 0.7,
      ticks: 90,
      origin: { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight },
      colors: ['#c9971f', '#2e8b57', '#c4503d', '#191917']
    });
  }
}

/* ============================== RENDER ============================== */

function renderAll() {
  renderHome();
  renderAnalytics();
  renderBudget();
  checkAchievements();
}

/* ---------- HOME ---------- */

function renderHome() {
  const key = dashMonth;
  const isCur = key === monthKey(today());
  const budget = state.budgets[key] || 0;
  const days = daysInMonth(key);
  const monthTxns = expensesInMonth(key);
  const dailyTxns = monthTxns.filter((t) => t.budgetImpact === 'daily');
  const capitalTxns = monthTxns.filter((t) => t.budgetImpact !== 'daily');
  const capitalSpent = sum(capitalTxns);
  const dailySpent = sum(dailyTxns);
  const todayStr = iso(today());
  const todayTxns = state.expenses.filter((t) => t.date === todayStr && t.budgetImpact === 'daily');
  const dailyAllow = budget > 0 ? budget / days : 0;
  const remaining = budget > 0 ? calculateDailyPace(todayTxns, dailyAllow) : 0;

  $('#home-month').textContent = monthLabel(key);

  // View toggle: pace vs all
  const paceMode = homeView === 'pace';
  $('#vt-pace').classList.toggle('active', paceMode);
  $('#vt-all').classList.toggle('active', !paceMode);
  $('#vt-pace').setAttribute('aria-selected', paceMode ? 'true' : 'false');
  $('#vt-all').setAttribute('aria-selected', paceMode ? 'false' : 'true');
  $('#pace-card').hidden = !paceMode;
  $('#total-card').hidden = paceMode;

  const el = $('#home-allowance');
  if (budget > 0) {
    el.textContent = Math.max(0, remaining).toFixed(2);
    el.style.color = remaining < 0 ? 'var(--red)' : 'var(--ink)';
    const used = dailyAllow - remaining;
    const pct = Math.min(100, Math.max(0, (used / dailyAllow) * 100));
    const fill = $('#home-pace-fill');
    fill.style.width = pct + '%';
    fill.style.background = pct > 100
      ? 'linear-gradient(90deg, #c4503d, #d96a52)'
      : pct > 75
        ? 'linear-gradient(90deg, #c9971f, #d9a73b)'
        : 'linear-gradient(90deg, #191917, #4a4a44)';
    $('#home-used').textContent = fmt(used) + ' used today';
    $('#home-left').textContent = remaining >= 0 ? fmt(remaining) + ' left today' : 'Over by ' + fmt(-remaining);
  } else {
    el.textContent = '0.00';
    el.style.color = 'var(--ink-faint)';
    $('#home-pace-fill').style.width = '0%';
    $('#home-used').textContent = 'Set a budget to start pacing';
    $('#home-left').textContent = 'Budget tab → Fixed Monthly Budget';
  }

  // Total card (all spending view)
  const income = incomeForMonth(key);
  const totalSpent = sum(monthTxns);
  $('#total-spent').textContent = totalSpent.toFixed(2);
  $('#total-daily').textContent = 'daily ' + fmt(dailySpent);
  $('#total-capital').textContent = 'capital ' + fmt(capitalSpent);
  $('#total-income').textContent = fmt(income);
  const netEl2 = $('#total-net');
  if (income > 0) {
    const net = income - totalSpent;
    netEl2.textContent = (net >= 0 ? '▲ net ' : '▼ net ') + fmt(Math.abs(net));
    netEl2.className = 'stamp chip ' + (net >= 0 ? 'ok' : 'over');
  } else {
    netEl2.textContent = 'no income set';
    netEl2.className = 'stamp chip';
  }
  const totalPct = totalSpent > 0 ? Math.round((dailySpent / totalSpent) * 100) : 50;
  $('#total-split').innerHTML = `
    <div class="split-track" aria-hidden="true"><i style="width:${totalPct}%"></i></div>
    <div class="split-legend"><span>▧ daily ${totalPct}%</span><span>▤ capital ${100 - totalPct}%</span></div>`;

  // Streak chip
  const streak = isCur ? onPaceStreak(key) : 0;
  const streakChip = $('#streak-chip');
  streakChip.classList.toggle('hot', streak >= 5);
  streakChip.classList.toggle('ok', streak > 0 && streak < 5);
  streakChip.classList.toggle('over', streak === 0 && budget > 0);
  $('#streak-num').textContent = streak;
  $('#capital-amt').textContent = fmt(capitalSpent);

  // Today list (filtered by view)
  const todayAll = state.expenses.filter((t) => t.date === todayStr);
  const todayShown = paceMode ? todayAll.filter((t) => t.budgetImpact === 'daily') : todayAll;
  const hiddenToday = todayAll.length - todayShown.length;
  $('#home-count').textContent = todayShown.length + ' transaction' + (todayShown.length === 1 ? '' : 's') +
    (hiddenToday > 0 ? ' · ' + hiddenToday + ' capital hidden' : '');
  $('#home-list').innerHTML = todayShown.length
    ? todayShown.map(txnItem).join('')
    : '<p class="txn-empty">' + (paceMode && hiddenToday > 0 ? 'Only capital spending today. Nothing hits your daily pace. 🏦' : 'Nothing today yet. Enjoy the quiet.') + '</p>';

  // Daily log (grouped by date)
  renderDailyLog(key);

  renderPeriod();

  renderHomeCat(key);
}

function renderHomeCat(key) {
  const info = petXpInfo();
  const mood = petMood(key);
  $('#home-cat-svg').innerHTML = catSVG(info.lv, mood);
  $('#home-cat-tag').textContent = info.tag;
  $('#home-cat-lv').textContent = 'LV ' + (info.lv + 1) + '/' + PET_LEVELS.length;
  $('#home-cat-line').textContent = info.line;
  $('#home-cat-xp-fill').style.width = info.pct + '%';
  $('#home-cat-meta').textContent = petTip(mood);
}

function renderDailyLog(key) {
  const monthTxns = expensesInMonth(key);
  const days = {};
  monthTxns.forEach((t) => {
    if (!days[t.date]) days[t.date] = [];
    days[t.date].push(t);
  });
  const dates = Object.keys(days).sort((a, b) => (b < a ? -1 : 1));
  const dailyAllow = state.budgets[key] > 0 ? state.budgets[key] / daysInMonth(key) : 0;
  const el = $('#daily-log');
  $('#log-count').textContent = dates.length + ' day' + (dates.length === 1 ? '' : 's');

  if (dates.length === 0) {
    el.innerHTML = '<p class="txn-empty">No spending in ' + monthLabel(key) + ' yet.</p>';
    return;
  }
  el.innerHTML = dates.map((d) => {
    const allItems = days[d].sort((a, b) => (b.amount < a.amount ? -1 : a.amount < b.amount ? 1 : 0));
    const items = homeView === 'pace' ? allItems.filter((t) => t.budgetImpact === 'daily') : allItems;
    const hidden = allItems.length - items.length;
    const total = sum(items);
    const over = dailyAllow > 0 && total > dailyAllow;
    const rows = items.map((t) => {
      const flags = [
        t.repeat ? '<span style="font-family:var(--mono);font-size:0.62rem;color:var(--ink-soft)">🔁</span>' : '',
        t.rate ? `<span style="font-size:0.75rem">${RATE_EMOJIS[t.rate]}</span>` : ''
      ].join(' ');
      return `<div class="log-item">
        <div class="txn-ico">${CAT_EMOJI[t.category] || '📦'}</div>
        <div class="txn-main">
          <div class="txn-name">${esc(t.name)}${t.budgetImpact === 'capital' ? ' <span style="font-family:var(--mono);font-size:0.62rem;color:var(--amber-deep)">CAP</span>' : ''}</div>
          <div class="txn-sub">${esc(t.category)} ${flags}</div>
        </div>
        <div class="txn-amt ${t.budgetImpact}">${fmt(t.amount)}</div>
        <div class="txn-actions">
          <button class="chip-btn" data-act="edit" data-id="${t.id}" aria-label="Edit">✎</button>
          <button class="chip-btn" data-act="del" data-id="${t.id}" aria-label="Delete">🗑</button>
        </div>
      </div>`;
    }).join('');
    const status = items.length === 0
      ? '<span class="log-status" style="color:var(--ink-faint)">capital only</span>'
      : `<span class="log-status ${over ? 'over' : 'ok'}" style="color:${over ? 'var(--red)' : 'var(--green)'}">${over ? '▲ over pace' : 'ok'}</span>`;
    return `<div class="log-day">
      <button class="log-head" data-day="${d}" aria-label="View ${d} breakdown">
        <span class="log-date">${weekday(d)} · ${fmtDate(d)}</span>
        ${status}
        <span class="log-total">${items.length ? fmt(total) : (hidden > 0 ? fmt(sum(allItems)) + ' cap' : fmt(0))}</span>
        ${hidden > 0 ? '<span class="log-hide-note">+' + hidden + ' cap hidden</span>' : ''}
      </button>
      <div class="log-items">${items.length ? rows : '<div class="log-item" style="border:none"><div class="txn-sub">Capital spending this day — tap the day to see it.</div></div>'}</div>
    </div>`;
  }).join('');
}

function renderPeriod() {
  const key = dashMonth;
  const budget = state.budgets[key] || 0;
  const days = daysInMonth(key);
  let spent, allow, label;
  if (period === 'day') {
    spent = sum(expensesInRange(iso(today()), iso(today())).filter((e) => e.budgetImpact === 'daily'));
    allow = budget > 0 ? budget / days : 0;
    label = 'today';
  } else if (period === 'week') {
    const [a, b] = weekRange();
    spent = sum(expensesInRange(a, b).filter((e) => e.budgetImpact === 'daily'));
    allow = budget > 0 ? budget / (days / 7) : 0;
    label = 'this week';
  } else {
    spent = sum(expensesInMonth(key).filter((e) => e.budgetImpact === 'daily'));
    allow = budget;
    label = 'this month';
  }
  const over = allow > 0 && spent > allow;
  const el = $('#period-readout');
  if (budget > 0) {
    el.innerHTML = `Spent <b>${fmt(spent)}</b> ${label} · allowance <b>${fmt(allow)}</b>${over ? ' <span class="warn">⚠️ over!</span>' : ''}`;
  } else {
    el.innerHTML = 'Set a budget to see your daily pace. Capital costs (bills, tuition) are tracked separately and never break the pace.';
  }
}

function txnItem(t, withActions) {
  const actions = withActions
    ? `<div class="txn-actions">
        <button class="ghost-btn small" data-act="edit" data-id="${t.id}">✎</button>
        <button class="ghost-btn small danger" data-act="del" data-id="${t.id}">🗑</button>
      </div>`
    : '';
  const flags = [
    t.repeat ? '<span class="cat-count">🔁 repeats</span>' : '',
    t.rate ? `<span class="cat-count">${RATE_EMOJIS[t.rate]}</span>` : ''
  ].join(' ');
  return `<div class="txn-item">
    <div class="txn-ico">${CAT_EMOJI[t.category] || '📦'}</div>
    <div class="txn-main">
      <div class="txn-name">${esc(t.name)}</div>
      <div class="txn-sub">${fmtDate(t.date)} · ${esc(t.category)}${t.budgetImpact === 'capital' ? ' · 🏦 capital' : ''} ${flags}</div>
    </div>
    <div class="txn-amt ${t.budgetImpact}">${fmt(t.amount)}</div>
    ${actions}
  </div>`;
}

/* ---------- ANALYTICS ---------- */

function renderAnalytics() {
  const key = dashMonth;
  const monthTxns = expensesInMonth(key);
  $('#an-month').textContent = monthLabel(key);

  // Category grid
  const groups = groupByCategory(monthTxns);
  const max = groups.length ? groups[0].total : 0;
  $('#category-grid').innerHTML = groups.length
    ? groups.map((g) => {
      const pct = max ? Math.round((g.total / max) * 100) : 0;
      return `<button class="cat-card" data-category="${esc(g.category)}">
        <div class="cat-emoji">${CAT_EMOJI[g.category] || '📦'}</div>
        <div class="cat-name">${esc(g.category)}</div>
        <div class="cat-total">${fmt(g.total)}</div>
        <div class="cat-count">${g.count} txn${g.count === 1 ? '' : 's'} · ${pct}% of top</div>
      </button>`;
    }).join('')
    : '<p class="txn-empty" style="grid-column:1/-1">No spending yet this month.</p>';

  // Pie chart
  const pieEl = $('#pie-chart');
  const pieEmpty = $('#pie-empty');
  if (pieChart) { pieChart.destroy(); pieChart = null; }
  if (groups.length === 0) {
    pieEl.style.display = 'none';
    pieEmpty.style.display = 'block';
  } else {
    pieEl.style.display = 'block';
    pieEmpty.style.display = 'none';
    pieChart = new Chart(pieEl, {
      type: 'doughnut',
      data: {
        labels: groups.map((g) => g.category),
        datasets: [{
          data: groups.map((g) => g.total),
          backgroundColor: groups.map((g) => cat(g.category).color),
          borderColor: '#fcfcfa',
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '64%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#6f6f68', font: { family: 'Space Grotesk', size: 11 }, boxWidth: 10, padding: 10 } }
        }
      }
    });
  }

  // Bar chart
  const days = daysInMonth(key);
  const daily = Array(days).fill(0);
  monthTxns.forEach((t) => {
    const d = Number(t.date.slice(8, 10));
    if (d >= 1 && d <= days) daily[d - 1] += t.amount;
  });
  if (barChart) { barChart.destroy(); barChart = null; }
  barChart = new Chart($('#bar-chart'), {
    type: 'bar',
    data: {
      labels: daily.map((_, i) => i + 1),
      datasets: [{
        data: daily,
        backgroundColor: daily.map((v) => (v > 0 ? '#c9971f' : 'rgba(25,25,23,0.07)')),
        borderRadius: 3,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.parsed.y) } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#a9a9a0', maxTicksLimit: 10, font: { family: 'Space Mono', size: 9 } } },
        y: { grid: { color: 'rgba(25,25,23,0.08)' }, ticks: { color: '#6f6f68', font: { family: 'Space Mono', size: 10 }, callback: (v) => 'RM' + v } }
      }
    }
  });

  // Cashflow cards
  const income = incomeForMonth(key);
  const totalSpent = sum(monthTxns);
  const cashflow = calculateMonthlyCashflow(monthTxns, income);
  const dailySpent = sum(monthTxns.filter((t) => t.budgetImpact === 'daily'));
  const capitalSpent = totalSpent - dailySpent;
  $('#cashflow-grid').innerHTML = [
    { label: 'Income', val: income > 0 ? fmt(income) : '—', cls: '' },
    { label: 'Daily spent', val: fmt(dailySpent), cls: '' },
    { label: 'Capital spent', val: fmt(capitalSpent), cls: 'good' },
    { label: 'Net cashflow', val: income > 0 ? fmt(cashflow) : '—', cls: income > 0 ? (cashflow >= 0 ? 'good' : 'bad') : '' }
  ].map((c) => `<div class="cashflow-card"><span>${c.label}</span><b class="${c.cls}">${c.val}</b></div>`).join('');
}

/* ---------- BUDGET ---------- */

function renderBudget() {
  const key = dashMonth;
  const budget = state.budgets[key] || 0;
  const income = incomeForMonth(key);
  const spent = sum(expensesInMonth(key));
  const net = income - spent;
  const dailySpent = sum(expensesInMonth(key).filter((t) => t.budgetImpact === 'daily'));

  $('#bd-month').textContent = monthLabel(key);
  $('#budget-income').textContent = income > 0 ? fmt(income) : 'RM 0.00';
  $('#budget-fixed').textContent = budget > 0 ? fmt(budget) : 'Not set';
  $('#budget-sub').textContent = budget > 0
    ? Math.round((dailySpent / budget) * 100) + '% of budget used · capital excluded'
    : 'Set a fixed budget to unlock pace, streak and 50/30/20.';
  $('#income-line').textContent = income > 0
    ? 'Income ' + fmt(income) + ' · ' + (net >= 0 ? 'saved ' + fmt(net) : 'overspent ' + fmt(-net)) + ' (cashflow)'
    : 'Add income to see net savings.';
  $('#income-line').style.color = income > 0 ? (net >= 0 ? 'var(--green)' : 'var(--red)') : '';

  // Pots
  const grid = $('#pot-grid');
  grid.innerHTML = state.pots.length
    ? state.pots.map((p) => {
      const pct = p.target > 0 ? Math.min(100, (p.saved / p.target) * 100) : 0;
      const emoji = POT_EMOJIS[hashStr(p.name) % POT_EMOJIS.length];
      const done = p.saved >= p.target && p.target > 0;
      return `<div class="pot-card">
        <div class="pot-head"><span class="pot-emoji">${emoji}</span><span class="pot-status">${done ? '<span class="done">✔ Goal reached!</span>' : Math.floor(pct) + '%'}</span></div>
        <div class="pot-name">${esc(p.name)}</div>
        <div class="pot-amounts"><b>${fmt(p.saved)}</b> / ${fmt(p.target)}</div>
        <div class="pot-progress"><i style="width:${pct}%"></i></div>
        <div class="pot-actions">
          <button class="ghost-btn small" data-act="fund" data-id="${p.id}">💰 Add</button>
          <button class="ghost-btn small" data-act="edit" data-id="${p.id}">✎</button>
          <button class="ghost-btn small danger" data-act="del" data-id="${p.id}">🗑</button>
        </div>
      </div>`;
    }).join('')
    : '<p class="txn-empty">No saving pots yet. Create one and start chasing your goals!</p>';

  // Money Cat
  const info = petXpInfo();
  const mood = petMood(key);
  $('#cat-svg').innerHTML = catSVG(info.lv, mood);
  $('#cat-tag').textContent = info.tag;
  $('#cat-lv').textContent = 'LV ' + (info.lv + 1) + '/' + PET_LEVELS.length;
  $('#cat-line').textContent = info.line;
  $('#cat-xp-fill').style.width = info.pct + '%';
  $('#cat-meta').textContent = petTip(mood);

  // Achievements
  const have = new Set(state.awards);
  $('#ach-count').textContent = state.awards.length + ' / ' + ACHIEVEMENTS.length;
  $('#ach-shelf').innerHTML = ACHIEVEMENTS.map((a) => {
    const got = have.has(a.id);
    return `<div class="ach ${got ? 'got' : 'locked'}">
      <span class="ach-ico">${got ? a.icon : '🔒'}</span>
      <span class="ach-txt"><b>${esc(a.title)}</b><small>${esc(a.desc)}</small></span>
    </div>`;
  }).join('');
}

function checkAchievements() {
  const unlocked = new Set(state.awards);
  let newly = null;
  ACHIEVEMENTS.forEach((a) => {
    if (!unlocked.has(a.id) && a.test()) {
      state.awards.push(a.id);
      newly = a;
    }
  });
  if (newly) {
    saveData();
    sfx.success();
    setTimeout(() => burst(1.6), 250);
    setTimeout(() => toast(`${newly.icon} Achievement unlocked: ${newly.title}!`, '🏆'), 300);
  }
}

/* ============================== TABS ============================== */

function switchTab(name) {
  view = name;
  $$('.nav-item, .toptab').forEach((b) => {
    const active = b.dataset.tab === name;
    b.classList.toggle('active', active);
    if (b.classList.contains('nav-item')) b.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  $$('.tab-view').forEach((v) => {
    const active = v.id === 'tab-' + name;
    v.classList.toggle('active', active);
    v.hidden = !active;
  });
  sfx.click();
}

function navMonth(delta) {
  dashMonth = shiftMonth(dashMonth, delta);
  const moved = rollRecurring(dashMonth);
  if (moved) { saveData(); toast(moved + ' recurring item(s) rolled into ' + monthLabel(dashMonth), '🔁'); }
  renderAll();
  sfx.click();
}

/* ============================== BOTTOM SHEET ============================== */

function openCategorySheet(category) {
  const group = groupByCategory(expensesInMonth(dashMonth)).find((g) => g.category === category);
  if (!group) return;
  const avg = group.total / group.count;

  $('#sheet-title').textContent = category + ' ' + (CAT_EMOJI[category] || '');
  $('#sheet-total').textContent = fmt(group.total);
  $('#sheet-count').textContent = group.count;
  $('#sheet-avg').textContent = fmt(avg);
  $('#sheet-list').innerHTML = group.transactions.map(txnItem).join('');

  renderSheetChart(categoryBarChartData(category));

  $('#sheet-backdrop').hidden = false;
  requestAnimationFrame(() => {
    $('#sheet-backdrop').classList.add('show');
    $('#category-sheet').classList.add('open');
  });
  document.body.classList.add('sheet-open');
  $('#sheet-close').focus();
}

// Per-day totals for a category across the viewed month.
function categoryBarChartData(category) {
  const days = daysInMonth(dashMonth);
  const daily = Array(days).fill(0);
  expensesInMonth(dashMonth)
    .filter((t) => t.category === category)
    .forEach((t) => {
      const d = Number(t.date.slice(8, 10));
      if (d >= 1 && d <= days) daily[d - 1] += t.amount;
    });
  return {
    kind: 'bar',
    labels: daily.map((_, i) => i + 1),
    values: daily,
    color: cat(category).color,
    label: 'spent per day'
  };
}

function openDaySheet(dayStr) {
  const items = expensesInMonth(dashMonth).filter((t) => t.date === dayStr);
  if (!items.length) return;
  const total = sum(items);
  const avg = total / items.length;
  const byCat = {};
  items.forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  $('#sheet-title').textContent = weekday(dayStr) + ' · ' + fmtDate(dayStr);
  $('#sheet-total').textContent = fmt(total);
  $('#sheet-count').textContent = items.length;
  $('#sheet-avg').textContent = fmt(avg);
  $('#sheet-list').innerHTML = items.map(txnItem).join('');

  renderSheetChart({
    kind: 'doughnut',
    labels: entries.map(([k]) => k),
    values: entries.map(([, v]) => v),
    colors: entries.map(([k]) => cat(k).color),
    label: 'by category'
  });

  $('#sheet-backdrop').hidden = false;
  requestAnimationFrame(() => {
    $('#sheet-backdrop').classList.add('show');
    $('#category-sheet').classList.add('open');
  });
  document.body.classList.add('sheet-open');
  $('#sheet-close').focus();
}

function renderSheetChart(cfg) {
  const wrap = $('#sheet-chart-wrap');
  const canvas = $('#sheet-chart');
  if (sheetChart) { sheetChart.destroy(); sheetChart = null; }
  if (!cfg) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  const isBar = cfg.kind === 'bar';
  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: !isBar, position: 'bottom', labels: { color: '#6f6f68', font: { family: 'Space Grotesk', size: 10 }, boxWidth: 9, padding: 8 } },
      tooltip: { callbacks: { label: (c) => isBar ? fmt(c.parsed.y) : fmt(c.parsed) } }
    }
  };
  if (isBar) {
    sheetChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: cfg.labels,
        datasets: [{
          data: cfg.values,
          backgroundColor: cfg.values.map((v) => (v > 0 ? (cfg.color || '#c9971f') : 'rgba(25,25,23,0.07)')),
          borderRadius: 3,
          borderSkipped: false
        }]
      },
      options: Object.assign({}, baseOpts, {
        scales: {
          x: { grid: { display: false }, ticks: { color: '#a9a9a0', maxTicksLimit: 10, font: { family: 'Space Mono', size: 8 } } },
          y: { grid: { color: 'rgba(25,25,23,0.08)' }, ticks: { color: '#6f6f68', font: { family: 'Space Mono', size: 9 }, callback: (v) => 'RM' + v } }
        }
      })
    });
  } else {
    sheetChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: cfg.labels,
        datasets: [{
          data: cfg.values,
          backgroundColor: cfg.colors,
          borderColor: '#fcfcfa',
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: Object.assign({}, baseOpts, { cutout: '60%' })
    });
  }
}

function closeCategorySheet() {
  $('#sheet-backdrop').classList.remove('show');
  $('#category-sheet').classList.remove('open');
  document.body.classList.remove('sheet-open');
  setTimeout(() => { $('#sheet-backdrop').hidden = true; }, 350);
}

/* ============================== MODALS ============================== */

function openModal(id) {
  $(id).classList.add('open');
  sfx.open();
  document.body.classList.add('modal-open');
  const focusable = $(id).querySelector('input, select, textarea, button');
  setTimeout(() => { if (focusable) focusable.focus(); }, 60);
}

function closeModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.classList.remove('open');
  if (!document.querySelector('.modal.open')) document.body.classList.remove('modal-open');
  const focusable = modal.querySelector('input, select, textarea, button');
  if (focusable) focusable.blur();
}

function openExpenseModal(exp) {
  $('#expense-modal-title').textContent = exp ? 'Edit Expense' : 'New Expense';
  $('#expense-id').value = exp ? exp.id : '';
  $('#expense-name').value = exp ? exp.name : '';
  $('#expense-amount').value = exp ? exp.amount : '';
  $('#expense-category').value = exp ? exp.category : 'Groceries';
  $('#expense-date').value = exp ? exp.date : iso(today());
  $('#expense-notes').value = exp ? exp.notes || '' : '';
  $('#expense-repeat').checked = exp ? !!exp.repeat : false;
  $('#expense-rate-val').value = exp && exp.rate ? exp.rate : 0;
  renderRateButtons(exp && exp.rate ? exp.rate : 0);
  $('#expense-delete').style.display = exp ? 'inline-flex' : 'none';
  openModal('#expense-modal');
}

function renderRateButtons(sel) {
  $$('.rate-btn').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.rate) === sel);
  });
}

function pickRate(rate) {
  $('#expense-rate-val').value = rate;
  renderRateButtons(rate);
  sfx.click();
}

function openBudgetModal() {
  $('#budget-modal-month').textContent = monthLabel(dashMonth);
  $('#budget-input').value = state.budgets[dashMonth] || '';
  openModal('#budget-modal');
}

function openIncomeModal() {
  $('#income-modal-month').textContent = monthLabel(dashMonth);
  $('#income-name').value = '';
  $('#income-amount').value = '';
  $('#income-date').value = dashMonth === monthKey(today()) ? iso(today()) : dashMonth + '-01';
  $('#income-repeat').checked = false;
  renderIncomeList();
  openModal('#income-modal');
}

function renderIncomeList() {
  const list = incomesInMonth(dashMonth);
  $('#income-list').innerHTML = list.length
    ? list.map((i) => `
      <div class="income-item">
        <span class="income-ico">${esc(i.emoji || '💰')}</span>
        <span class="income-main">
          <b>${esc(i.name)}</b>
          <small>${fmtDate(i.date)}${i.repeat ? ' · 🔁 repeats monthly' : ''}</small>
        </span>
        <span class="income-amt">+${fmt(i.amount)}</span>
        <button class="ghost-btn small danger" data-act="del-income" data-id="${i.id}" aria-label="Delete income">🗑</button>
      </div>`).join('')
    : '<p class="txn-empty" style="padding:14px 0">No income added this month yet.</p>';
}

function openPotModal(pot) {
  $('#pot-modal-title').textContent = pot ? 'Edit Saving Pot' : 'New Saving Pot';
  $('#pot-id').value = pot ? pot.id : '';
  $('#pot-name').value = pot ? pot.name : '';
  $('#pot-target').value = pot ? pot.target : '';
  $('#pot-saved').value = pot ? pot.saved : '';
  $('#pot-delete').style.display = pot ? 'inline-flex' : 'none';
  openModal('#pot-modal');
}

function openFundModal(pot) {
  fundPotId = pot.id;
  $('#fund-title').textContent = 'Add money · ' + pot.name;
  $('#fund-sub').textContent = `${fmt(pot.saved)} saved of ${fmt(pot.target)} (${Math.floor((pot.saved / pot.target) * 100)}%)`;
  $('#fund-amount').value = '';
  openModal('#fund-modal');
}

/* ============================== ACTIONS ============================== */

function saveExpense(ev) {
  ev.preventDefault();
  const id = $('#expense-id').value;
  const prev = id ? state.expenses.find((e) => e.id === id) : null;
  const exp = {
    id: id || uid(),
    createdAt: prev ? prev.createdAt : new Date().toISOString(),
    name: $('#expense-name').value.trim(),
    amount: parseFloat($('#expense-amount').value),
    category: $('#expense-category').value,
    date: $('#expense-date').value,
    notes: $('#expense-notes').value.trim(),
    repeat: $('#expense-repeat').checked,
    rate: Number($('#expense-rate-val').value) || 0,
    budgetImpact: categorizeExpense($('#expense-category').value)
  };
  if (!exp.name) { sfx.error(); toast('Enter a name', '⚠️'); return; }
  if (!(exp.amount > 0)) { sfx.error(); toast('Amount must be more than 0', '⚠️'); return; }
  const isNew = !id;
  if (id) {
    state.expenses = state.expenses.map((e) => (e.id === id ? exp : e));
    sfx.success();
    toast('Expense updated!', '✏️');
  } else {
    state.expenses = [exp, ...state.expenses];
    sfx.success();
    toast('Expense saved!', '💸');
    burst(1);
  }
  if (isNew && exp.repeat) addPetXp(8);
  if (isNew && exp.rate) addPetXp(3);
  closeModal('#expense-modal');
  saveData();
  renderAll();
}

function deleteExpense(exp) {
  state.expenses = state.expenses.filter((e) => e.id !== exp.id);
  lastDeleted = exp;
  lastDeletedType = 'expense';
  saveData();
  sfx.coin();
  toastUndo();
  renderAll();
}

function saveBudget(ev) {
  ev.preventDefault();
  const amount = parseFloat($('#budget-input').value);
  if (isNaN(amount) || amount < 0) { sfx.error(); toast('Enter a valid budget', '⚠️'); return; }
  state.budgets[dashMonth] = amount;
  saveData();
  renderAll();
  sfx.success();
  toast(`Budget set to ${fmt(amount)}`, '🎯');
  addPetXp(10);
  closeModal('#budget-modal');
}

function addIncome(ev) {
  ev.preventDefault();
  const name = $('#income-name').value.trim();
  const amount = parseFloat($('#income-amount').value);
  const date = $('#income-date').value || dashMonth + '-01';
  const repeat = $('#income-repeat').checked;
  if (!name) { sfx.error(); toast('Enter a source name', '⚠️'); return; }
  if (!(amount > 0)) { sfx.error(); toast('Amount must be more than 0', '⚠️'); return; }
  state.incomes.push({
    id: uid(),
    createdAt: new Date().toISOString(),
    name,
    amount,
    emoji: repeat ? '🔁' : '💰',
    date,
    repeat
  });
  state.incomes = state.incomes.sort((a, b) => (a.date < b.date ? -1 : 1));
  saveData();
  sfx.coin();
  toast(name + ' added to income', repeat ? '🔁' : '💰');
  if (repeat) addPetXp(8);
  addPetXp(5);
  closeModal('#income-modal');
  renderAll();
}

function deleteIncome(id) {
  const target = state.incomes.find((i) => i.id === id);
  state.incomes = state.incomes.filter((i) => i.id !== id);
  lastDeleted = target;
  lastDeletedType = 'income';
  saveData();
  sfx.coin();
  toastUndo();
  renderAll();
}

function savePot(ev) {
  ev.preventDefault();
  const id = $('#pot-id').value;
  const prev = id ? state.pots.find((p) => p.id === id) : null;
  const pot = {
    id: id || uid(),
    createdAt: prev ? prev.createdAt : new Date().toISOString(),
    name: $('#pot-name').value.trim(),
    target: parseFloat($('#pot-target').value),
    saved: parseFloat($('#pot-saved').value) || 0,
    color: (prev || {}).color || randPotColor()
  };
  if (!pot.name) { sfx.error(); toast('Enter a goal name', '⚠️'); return; }
  if (!(pot.target > 0)) { sfx.error(); toast('Target must be more than 0', '⚠️'); return; }
  const hitGoal = pot.target > 0 && pot.saved >= pot.target && !(prev && prev.saved >= prev.target);
  if (id) {
    state.pots = state.pots.map((p) => (p.id === id ? pot : p));
    sfx.success();
    toast('Pot updated!', '✏️');
  } else {
    state.pots = [pot, ...state.pots];
    sfx.success();
    toast('New pot created!', '🏺');
    burst(1);
  }
  closeModal('#pot-modal');
  saveData();
  renderAll();
  if (hitGoal) celebrateGoal(pot);
}

function deletePot(pot) {
  state.pots = state.pots.filter((p) => p.id !== pot.id);
  lastDeleted = pot;
  lastDeletedType = 'pot';
  saveData();
  sfx.coin();
  toastUndo();
  renderAll();
}

function fundPot(ev) {
  ev.preventDefault();
  const amount = parseFloat($('#fund-amount').value);
  if (isNaN(amount) || amount <= 0) { sfx.error(); toast('Enter a valid amount', '⚠️'); return; }
  const pot = state.pots.find((p) => p.id === fundPotId);
  if (!pot) { sfx.error(); toast('Pot not found', '⚠️'); return; }
  const wasGoal = pot.target > 0 && pot.saved >= pot.target;
  pot.saved = Math.max(0, pot.saved + amount);
  saveData();
  renderAll();
  sfx.coin();
  closeModal('#fund-modal');
  toast(`Added ${fmt(amount)} to "${pot.name}"`, '💰');
  if (pot.target > 0 && pot.saved >= pot.target && !wasGoal) celebrateGoal(pot);
  else if (pot.saved >= pot.target) burst(1.2);
}

function celebrateGoal(pot) {
  burst(2);
  setTimeout(() => burst(1.2), 350);
  sfx.success();
  toast(`🎉 Goal reached! ${fmt(pot.saved)} / ${fmt(pot.target)} for "${pot.name}"`, '🏆');
  addPetXp(25);
}

/* ============================== EXPORT / RESTORE ============================== */

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function backupData() {
  const payload = { app: 'spendsync', version: 3, exportedAt: new Date().toISOString(), data: state };
  download('spendsync-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(payload, null, 2), 'application/json');
  sfx.success();
  toast('Backup downloaded!', '💾');
}

async function restoreData(ev) {
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const d = parsed && parsed.data ? parsed.data : parsed;
    if (!d || (!Array.isArray(d.expenses) && !Array.isArray(d.incomes))) throw new Error('bad backup');
    state = normalizeState(d);
    saveData();
    renderAll();
    sfx.success();
    burst(1.2);
    toast('Backup restored!', '🎉');
  } catch (err) {
    sfx.error();
    toast('Invalid backup file', '⚠️');
  }
}

function downloadCSV() {
  const monthExp = expensesInMonth(dashMonth).sort((a, b) => (a.date < b.date ? -1 : 1));
  const incs = incomesInMonth(dashMonth).sort((a, b) => (a.date < b.date ? -1 : 1));
  const rows = [
    ['Type', 'Date', 'Category', 'Name', 'Amount (RM)', 'Rating', 'Repeats', 'Budget Impact', 'Notes'],
    ...incs.map((i) => ['income', i.date, '—', i.name, i.amount.toFixed(2), '', i.repeat ? 'yes' : '', '', '']),
    ...monthExp.map((e) => ['expense', e.date, e.category, e.name, e.amount.toFixed(2), e.rate ? e.rate : '', e.repeat ? 'yes' : '', e.budgetImpact || 'daily', e.notes || ''])
  ];
  const csv = rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  download(`spendsync-${dashMonth}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
  sfx.success();
  toast('CSV downloaded!', '📥');
}

function downloadReport() {
  const monthExp = expensesInMonth(dashMonth).sort((a, b) => (a.date < b.date ? -1 : 1));
  const spent = sum(monthExp);
  const dailySpent = sum(monthExp.filter((t) => t.budgetImpact === 'daily'));
  const capitalSpent = spent - dailySpent;
  const budget = state.budgets[dashMonth] || 0;
  const income = incomeForMonth(dashMonth);
  const net = income - spent;
  const rated = monthExp.filter((e) => e.rate >= 1 && e.rate <= 5);
  const score = rated.length ? Math.round((rated.reduce((a, e) => a + e.rate, 0) / rated.length) * 10) / 10 : 0;
  const lines = [];
  lines.push('========================================');
  lines.push('   💸 SPENDSYNC — MONTHLY REPORT');
  lines.push('========================================');
  lines.push(`Month:        ${monthLabel(dashMonth)}`);
  lines.push(`Generated:    ${new Date().toLocaleString('en-MY')}`);
  lines.push('');
  lines.push('--- SUMMARY ---');
  lines.push(`Budget:       ${budget > 0 ? fmt(budget) : 'Not set'}`);
  lines.push(`Income:       ${income > 0 ? fmt(income) : 'Not set'}`);
  lines.push(`Net cashflow: ${income > 0 ? fmt(net) : '—'}`);
  lines.push(`Total spent:  ${fmt(spent)}`);
  lines.push(`Daily spent:  ${fmt(dailySpent)}`);
  lines.push(`Capital:      ${fmt(capitalSpent)}`);
  lines.push(`Value score:  ${rated.length ? score.toFixed(1) + '/5 (' + rated.length + ' rated)' : '—'}`);
  lines.push('');
  lines.push('--- TRANSACTIONS ---');
  if (monthExp.length === 0) {
    lines.push('  (none)');
  } else {
    monthExp.forEach((e) => {
      lines.push(`  [${e.date}] ${e.name} — ${fmt(e.amount)} (${e.category}, ${e.budgetImpact})${e.rate ? ' ' + RATE_EMOJIS[e.rate] : ''}${e.repeat ? ' 🔁' : ''}`);
    });
  }
  lines.push('');
  lines.push('Tracked with 💜 by SpendSync');
  download(`spendsync-report-${dashMonth}.txt`, lines.join('\r\n'), 'text/plain;charset=utf-8');
  sfx.success();
  toast('Report downloaded!', '📥');
}

/* ============================== EVENTS ============================== */

function setupEvents() {
  $$('.nav-item, .toptab').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $('#home-prev').addEventListener('click', () => navMonth(-1));
  $('#home-next').addEventListener('click', () => navMonth(1));

  $('#add-expense-btn').addEventListener('click', () => openExpenseModal(null));
  $('#edit-budget').addEventListener('click', openBudgetModal);
  $('#edit-income').addEventListener('click', openIncomeModal);
  $('#add-pot-btn').addEventListener('click', () => openPotModal(null));

  $('#vt-pace').addEventListener('click', () => { homeView = 'pace'; localStorage.setItem('ss_view', 'pace'); renderHome(); sfx.click(); });
  $('#vt-all').addEventListener('click', () => { homeView = 'all'; localStorage.setItem('ss_view', 'all'); renderHome(); sfx.click(); });

  $$('.period-pills .pill').forEach((p) => {
    p.addEventListener('click', () => {
      $$('.period-pills .pill').forEach((x) => x.classList.toggle('active', x === p));
      period = p.dataset.period;
      renderPeriod();
      sfx.click();
    });
  });

  $('#daily-log').addEventListener('click', (e) => {
    const dayHead = e.target.closest('.log-head');
    if (dayHead) { openDaySheet(dayHead.dataset.day); return; }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const exp = state.expenses.find((x) => x.id === btn.dataset.id);
    if (!exp) return;
    if (btn.dataset.act === 'edit') openExpenseModal(exp);
    else deleteExpense(exp);
  });

  $('#category-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.cat-card');
    if (card) openCategorySheet(card.dataset.category);
  });

  $('#pot-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const pot = state.pots.find((x) => x.id === btn.dataset.id);
    if (!pot) return;
    if (btn.dataset.act === 'fund') openFundModal(pot);
    else if (btn.dataset.act === 'edit') openPotModal(pot);
    else deletePot(pot);
  });

  $('#income-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act="del-income"]');
    if (btn) deleteIncome(btn.dataset.id);
  });

  $('#sheet-close').addEventListener('click', closeCategorySheet);
  $('#sheet-backdrop').addEventListener('click', closeCategorySheet);

  $('#expense-form').addEventListener('submit', saveExpense);
  $('#budget-form').addEventListener('submit', saveBudget);
  $('#income-form').addEventListener('submit', addIncome);
  $('#pot-form').addEventListener('submit', savePot);
  $('#fund-form').addEventListener('submit', fundPot);

  $$('.rate-btn').forEach((b) => b.addEventListener('click', () => pickRate(Number(b.dataset.rate))));
  $('#rate-clear').addEventListener('click', () => pickRate(0));

  $$('.quick-chips .chip-btn').forEach((c) => {
    c.addEventListener('click', () => {
      const input = c.closest('.modal-card').querySelector('input[type="number"]');
      if (input) input.value = c.dataset.amount;
      sfx.click();
    });
  });

  $('#expense-delete').addEventListener('click', async () => {
    const id = $('#expense-id').value;
    const exp = state.expenses.find((x) => x.id === id);
    if (exp) await deleteExpense(exp);
    closeModal('#expense-modal');
  });
  $('#pot-delete').addEventListener('click', async () => {
    const id = $('#pot-id').value;
    const pot = state.pots.find((x) => x.id === id);
    if (pot) await deletePot(pot);
    closeModal('#pot-modal');
  });

  $('#cat-row').addEventListener('click', () => {
    petReaction($('#cat-svg'));
    addPetXp(2);
    renderBudget();
    sfx.coin();
    toast(MEOWS[Math.floor(Math.random() * MEOWS.length)] + ' (+2 XP)', '🐱');
  });
  $('#cat-row').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      $('#cat-row').click();
    }
  });

  $('#home-cat-row').addEventListener('click', () => {
    petReaction($('#home-cat-svg'));
    addPetXp(2);
    renderHome();
    sfx.coin();
    toast(MEOWS[Math.floor(Math.random() * MEOWS.length)] + ' (+2 XP)', '🐱');
  });
  $('#home-cat-row').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      $('#home-cat-row').click();
    }
  });

  $('#download-csv').addEventListener('click', downloadCSV);
  $('#download-report').addEventListener('click', downloadReport);
  $('#backup-btn').addEventListener('click', backupData);
  $('#restore-btn').addEventListener('click', () => {
    if (confirm('Restore replaces ALL current data on this device. Continue?')) $('#restore-file').click();
  });
  $('#restore-file').addEventListener('change', restoreData);

  $('#sound-btn').addEventListener('click', toggleSound);
  $('#sound-btn-top').addEventListener('click', toggleSound);

  document.querySelectorAll('[data-close]').forEach((b) => {
    b.addEventListener('click', () => closeModal('#' + b.dataset.close));
  });
  document.querySelectorAll('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m) closeModal('#' + m.id); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('.modal.open');
    if (open) closeModal('#' + open.id);
    else if ($('#category-sheet').classList.contains('open')) closeCategorySheet();
  });

  $('#expense-category').innerHTML = CATEGORIES.map((c) => `<option value="${c.name}">${c.emoji} ${c.name}${c.type === 'need' ? ' (need)' : c.type === 'want' ? ' (want)' : ' (save)'}</option>`).join('');
}

/* ============================== INIT ============================== */

setupEvents();
updateSoundBtn();
$('#splash').style.display = 'none';
$('#app').style.display = 'block';
renderAll();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
