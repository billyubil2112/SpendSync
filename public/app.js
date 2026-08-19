'use strict';

/* ============================== CONSTANTS ============================== */

const CATEGORIES = [
  { name: 'Groceries', emoji: '🛒', color: '#34e0a1' },
  { name: 'Dining Out', emoji: '🍜', color: '#ffb347' },
  { name: 'Personal Care', emoji: '🧴', color: '#ff6b9d' },
  { name: 'Transport', emoji: '🚗', color: '#4cc9f0' },
  { name: 'Bills & Utilities', emoji: '💡', color: '#ffd166' },
  { name: 'Housing', emoji: '🏠', color: '#9b8cff' },
  { name: 'Shopping', emoji: '🛍️', color: '#f472b6' },
  { name: 'Entertainment', emoji: '🎬', color: '#a3e635' },
  { name: 'Health', emoji: '💊', color: '#2dd4bf' },
  { name: 'Education', emoji: '📚', color: '#60a5fa' },
  { name: 'Travel', emoji: '✈️', color: '#38bdf8' },
  { name: 'Family & Kids', emoji: '👨‍👩‍👧', color: '#fbbf24' },
  { name: 'Insurance', emoji: '🛡️', color: '#94a3b8' },
  { name: 'Investments', emoji: '📈', color: '#4ade80' },
  { name: 'Others', emoji: '📦', color: '#cbd5e1' }
];
const POT_EMOJIS = ['🎯', '🏖️', '📱', '🚗', '✈️', '🏠', '💍', '🎁', '💻', '🎓', '🐱', '🏋️', '🎸', '🚲'];

const cat = (name) => CATEGORIES.find((c) => c.name === name) || { name, emoji: '📦', color: '#cbd5e1' };

/* ============================== STATE ============================== */

let state = { budgets: {}, expenses: [], pots: [] };
let view = 'dashboard';
let dashMonth = monthKey(today());
let summaryMonth = monthKey(today());
let period = 'day';
let fundPotId = null;
let lastDeleted = null;
let lastDeletedType = null;

let pieChart = null;
let barChart = null;

/* ============================== UTILS ============================== */

const $ = (sel) => document.querySelector(sel);

function pad(n) { return String(n).padStart(2, '0'); }

function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function today() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function monthKey(dateStr) { return dateStr.slice(0, 7); }

function daysInMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' });
}

function fmtDate(dStr) {
  return new Date(dStr + 'T00:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
}

function weekday(dStr) {
  return new Date(dStr + 'T00:00:00').toLocaleDateString('en-MY', { weekday: 'short' });
}

function fmt(n) {
  return 'RM ' + n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function weekRange() {
  const now = today();
  const dow = (now.getDay() + 6) % 7;
  const mon = new Date(now); mon.setDate(now.getDate() - dow);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return [iso(mon), iso(sun)];
}

function expensesInRange(fromStr, toStr) {
  return state.expenses.filter((e) => e.date >= fromStr && e.date <= toStr);
}

function expensesInMonth(key) {
  return state.expenses.filter((e) => e.date.startsWith(key));
}

function sum(list) { return list.reduce((a, e) => a + e.amount, 0); }

/* ============================== SOUND ============================== */

let soundOn = localStorage.getItem('ss_sound') !== 'off';
let audioCtx = null;

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
}

/* ============================== CONFETTI ============================== */

function burst(scale) {
  if (typeof confetti !== 'function') return;
  confetti({
    particleCount: 90 * (scale || 1),
    spread: 75,
    startVelocity: 42,
    origin: { x: 0.5, y: 0.7 },
    colors: ['#34e0a1', '#7c6cff', '#ff6b9d', '#ffd166', '#4cc9f0']
  });
}

/* ============================== API ============================== */

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Something went wrong');
  }
  return res.json();
}

/* ============================== BOOTSTRAP ============================== */

async function loadState() {
  try {
    state = await api('GET', '/api/state');
    $('#splash').style.display = 'none';
    $('#app').style.display = 'block';
    renderAll();
    sfx.open();
  } catch (err) {
    $('#splash').style.display = 'none';
    $('#offline').style.display = 'flex';
  }
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
  el.innerHTML = '<span>🗑️</span><span>Deleted</span><button class="chip-btn" id="undo-btn">Undo</button>';
  wrap.appendChild(el);
  $('#undo-btn').addEventListener('click', async () => {
    try {
      if (lastDeletedType === 'expense') {
        await api('POST', '/api/expenses', lastDeleted);
      } else if (lastDeletedType === 'pot') {
        await api('POST', '/api/pots', lastDeleted);
      }
      lastDeleted = null; lastDeletedType = null;
      el.remove();
      sfx.success();
      toast('Restored!', '↩️');
      await reload();
    } catch (e) { sfx.error(); toast(e.message, '⚠️'); }
  });
  setTimeout(() => el.remove(), 5000);
}

/* ============================== RENDER ============================== */

function renderAll() {
  updateSoundBtn();
  renderBudget();
  renderPeriod();
  renderCharts();
  renderCategories();
  renderExpenses();
  renderPots();
  renderSummary();
}

function renderBudget() {
  const budget = state.budgets[dashMonth] || 0;
  const spent = sum(expensesInMonth(dashMonth));
  const left = budget - spent;
  const days = daysInMonth(dashMonth);
  const dailyAllow = budget > 0 ? budget / days : 0;
  const weeklyAllow = budget > 0 ? budget / (days / 7) : 0;

  $('#month-label').textContent = monthLabel(dashMonth);
  $('#budget-amount').textContent = budget > 0 ? fmt(budget) : 'Not set yet';
  $('#stat-spent').textContent = fmt(spent);
  $('#stat-left').textContent = budget > 0 ? fmt(left) : fmt(0);
  $('#stat-left').className = 'hs-value ' + (budget > 0 && left < 0 ? 'bad' : 'good');
  $('#stat-daily').textContent = budget > 0 ? fmt(dailyAllow) : '—';
  $('#stat-weekly').textContent = budget > 0 ? fmt(weeklyAllow) : '—';

  const circ = 2 * Math.PI * 52;
  const pct = budget > 0 ? Math.min(200, (spent / budget) * 100) : (spent > 0 ? 100 : 0);
  const ring = $('#budget-ring-fg');
  ring.style.strokeDasharray = circ;
  ring.style.strokeDashoffset = circ * (1 - Math.min(1, pct / 100));
  $('#budget-pct').textContent = Math.round(Math.min(pct, 999)) + '%';
  ring.style.stroke = pct > 100 ? 'var(--danger)' : pct > 75 ? 'var(--warn)' : 'var(--accent)';
}

function renderPeriod() {
  const budget = state.budgets[dashMonth] || 0;
  const days = daysInMonth(dashMonth);
  let spent, allow, label;
  if (period === 'day') {
    spent = sum(expensesInRange(iso(today()), iso(today())));
    allow = budget > 0 ? budget / days : 0;
    label = 'today';
  } else if (period === 'week') {
    const [a, b] = weekRange();
    spent = sum(expensesInRange(a, b));
    allow = budget > 0 ? budget / (days / 7) : 0;
    label = 'this week';
  } else {
    spent = sum(expensesInMonth(dashMonth));
    allow = budget;
    label = 'this month';
  }
  const over = allow > 0 && spent > allow;
  const el = $('#period-readout');
  el.innerHTML = `Spent <b>${fmt(spent)}</b> ${label} · allowance <b>${fmt(allow)}</b>`;
  if (over) el.innerHTML += ' <span style="color:var(--danger)">⚠️ over!</span>';
  el.querySelectorAll('b').forEach((b) => (b.style.color = over ? 'var(--danger)' : 'var(--accent)'));
}

function renderCharts() {
  const monthExp = expensesInMonth(dashMonth);

  // Pie
  const byCat = {};
  monthExp.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const pieEl = $('#pie-chart');
  const emptyEl = $('#pie-empty');

  if (pieChart) { pieChart.destroy(); pieChart = null; }
  if (entries.length === 0) {
    pieEl.style.display = 'none';
    emptyEl.style.display = 'block';
  } else {
    pieEl.style.display = 'block';
    emptyEl.style.display = 'none';
    const labels = entries.map(([k]) => k);
    const data = entries.map(([, v]) => v);
    const colors = entries.map(([k]) => cat(k).color);
    pieChart = new Chart(pieEl, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: 'rgba(11,16,32,0.9)', borderWidth: 3, hoverOffset: 10 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'right', labels: { color: 'rgba(244,247,255,0.85)', font: { family: 'Plus Jakarta Sans', size: 12 }, boxWidth: 10, padding: 14 } }
        }
      }
    });
  }

  // Bar
  const days = daysInMonth(dashMonth);
  const daily = Array(days).fill(0);
  monthExp.forEach((e) => { const d = Number(e.date.slice(8, 10)); if (d >= 1 && d <= days) daily[d - 1] += e.amount; });
  if (barChart) { barChart.destroy(); barChart = null; }
  barChart = new Chart($('#bar-chart'), {
    type: 'bar',
    data: {
      labels: daily.map((_, i) => i + 1),
      datasets: [{
        label: 'Spent',
        data: daily,
        backgroundColor: daily.map((v) => (v > 0 ? 'rgba(52,224,161,0.75)' : 'rgba(255,255,255,0.06)')),
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.parsed.y) } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: 'rgba(244,247,255,0.5)', maxTicksLimit: 10, font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(244,247,255,0.6)', font: { size: 11 }, callback: (v) => 'RM' + v } }
      }
    }
  });
}

function renderCategories() {
  const monthExp = expensesInMonth(dashMonth);
  const byCat = {};
  monthExp.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const list = $('#category-list');
  const max = entries.length ? entries[0][1] : 0;

  if (entries.length === 0) {
    list.innerHTML = '<div class="empty-state"><span class="big">🫧</span>Nothing here yet — add your first expense!</div>';
    return;
  }
  list.innerHTML = entries.map(([name, amt], i) => {
    const c = cat(name);
    return `<div class="cat-row" style="animation-delay:${i * 40}ms">
      <span class="cat-dot" style="background:${c.color};color:${c.color}"></span>
      <span class="cat-name">${c.emoji} ${name}</span>
      <span class="cat-bar"><i style="width:${max ? (amt / max) * 100 : 0}%;background:${c.color};box-shadow:0 0 8px ${c.color}"></i></span>
      <span class="cat-amt">${fmt(amt)}</span>
    </div>`;
  }).join('');
}

function renderExpenses() {
  const monthExp = expensesInMonth(dashMonth).sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : 0));
  const list = $('#expense-list');

  if (monthExp.length === 0) {
    list.innerHTML = '<div class="empty-state"><span class="big">🪙</span>No transactions in ' + monthLabel(dashMonth) + '.</div>';
    return;
  }
  list.innerHTML = monthExp.map((e, i) => {
    const c = cat(e.category);
    return `<div class="expense-item" style="animation-delay:${Math.min(i, 20) * 30}ms">
      <div class="exp-icon" style="background:${c.color}22">${c.emoji}</div>
      <div class="exp-main">
        <div class="exp-name">${esc(e.name)} <span class="exp-tag" style="color:${c.color};background:${c.color}1a">${esc(e.category)}</span></div>
        <div class="exp-meta">${fmtDate(e.date)} · ${weekday(e.date)}${e.notes ? ' · <span class="exp-notes">' + esc(e.notes) + '</span>' : ''}</div>
      </div>
      <div class="exp-amount">${fmt(e.amount)}</div>
      <div class="exp-actions">
        <button class="mini-btn" data-act="edit" data-id="${e.id}">✎</button>
        <button class="mini-btn danger" data-act="del" data-id="${e.id}">🗑</button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const exp = state.expenses.find((x) => x.id === btn.dataset.id);
      if (!exp) return;
      if (btn.dataset.act === 'edit') openExpenseModal(exp);
      else deleteExpense(exp);
    });
  });
}

function renderPots() {
  const grid = $('#pot-grid');
  if (state.pots.length === 0) {
    grid.innerHTML = '<div class="card glass" style="grid-column:1/-1"><div class="empty-state"><span class="big">🏺</span>No saving pots yet. Create one and start chasing your goals!</div></div>';
    return;
  }
  grid.innerHTML = state.pots.map((p, i) => {
    const pct = p.target > 0 ? Math.min(100, (p.saved / p.target) * 100) : 0;
    const emoji = POT_EMOJIS[hashStr(p.name) % POT_EMOJIS.length];
    const done = p.saved >= p.target && p.target > 0;
    return `<div class="pot-card glass" style="--potc:${p.color};animation-delay:${i * 50}ms">
      <div class="pot-head"><span class="pot-emoji">${emoji}</span><span class="pot-status">${done ? '<span class="done">✔ Goal reached!</span>' : Math.floor(pct) + '%'}</span></div>
      <div class="pot-name">${esc(p.name)}</div>
      <div class="pot-amounts"><b>${fmt(p.saved)}</b> / ${fmt(p.target)}</div>
      <div class="pot-progress"><i style="width:${pct}%"></i></div>
      <div class="pot-actions">
        <button class="mini-btn" data-act="fund" data-id="${p.id}">💰 Add</button>
        <button class="mini-btn" data-act="edit" data-id="${p.id}">✎ Edit</button>
        <button class="mini-btn danger" data-act="del" data-id="${p.id}">🗑</button>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pot = state.pots.find((x) => x.id === btn.dataset.id);
      if (!pot) return;
      if (btn.dataset.act === 'fund') openFundModal(pot);
      else if (btn.dataset.act === 'edit') openPotModal(pot);
      else deletePot(pot);
    });
  });
}

function renderSummary() {
  $('#sum-month-label').textContent = monthLabel(summaryMonth);
  const monthExp = expensesInMonth(summaryMonth).sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : 0));
  const spent = sum(monthExp);
  const budget = state.budgets[summaryMonth] || 0;
  const byCat = {};
  monthExp.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const todayNum = new Date().getDate();
  const isCur = summaryMonth === monthKey(iso(today()));
  const daysElapsed = isCur ? Math.min(todayNum, daysInMonth(summaryMonth)) : daysInMonth(summaryMonth);
  const dailyAvg = daysElapsed ? spent / daysElapsed : 0;

  const stats = [
    { label: 'Total spent', value: fmt(spent), sub: monthExp.length + ' transactions' },
    { label: 'Budget', value: budget > 0 ? fmt(budget) : '—', sub: budget > 0 ? Math.round((spent / budget) * 100) + '% used' : 'not set' },
    { label: 'Remaining', value: budget > 0 ? fmt(budget - spent) : '—', sub: budget - spent < 0 ? 'over budget' : 'of budget' },
    { label: 'Daily average', value: fmt(dailyAvg), sub: 'per day so far' },
    { label: 'Top category', value: top ? top[0] : '—', sub: top ? fmt(top[1]) : '' }
  ];
  $('#sum-stats').innerHTML = stats.map((s, i) => `
    <div class="stat-card glass" style="animation-delay:${i * 40}ms">
      <div class="sc-label">${s.label}</div>
      <div class="sc-value">${s.value}</div>
      <div class="sc-sub">${s.sub}</div>
    </div>`).join('');

  const list = $('#sum-list');
  if (monthExp.length === 0) {
    list.innerHTML = '<div class="empty-state"><span class="big">📭</span>No transactions in ' + monthLabel(summaryMonth) + '.</div>';
  } else {
    list.innerHTML = monthExp.map((e, i) => {
      const c = cat(e.category);
      return `<div class="expense-item" style="animation-delay:${Math.min(i, 20) * 30}ms">
        <div class="exp-icon" style="background:${c.color}22">${c.emoji}</div>
        <div class="exp-main">
          <div class="exp-name">${esc(e.name)} <span class="exp-tag" style="color:${c.color};background:${c.color}1a">${esc(e.category)}</span></div>
          <div class="exp-meta">${fmtDate(e.date)} · ${weekday(e.date)}${e.notes ? ' · <span class="exp-notes">' + esc(e.notes) + '</span>' : ''}</div>
        </div>
        <div class="exp-amount">${fmt(e.amount)}</div>
      </div>`;
    }).join('');
  }
}

/* ============================== HELPERS ============================== */

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

function randPotColor() {
  return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)].color;
}

/* ============================== MODALS ============================== */

function openModal(id) {
  $(id).classList.add('open');
  sfx.open();
}

function closeModal(id) {
  $(id).classList.remove('open');
}

document.querySelectorAll('[data-close]').forEach((b) => {
  b.addEventListener('click', () => closeModal('#' + b.dataset.close));
});
document.querySelectorAll('.modal').forEach((m) => {
  m.addEventListener('click', (e) => { if (e.target === m) closeModal('#' + m.id); });
});

function openExpenseModal(exp) {
  $('#expense-modal-title').textContent = exp ? 'Edit Expense' : 'New Expense';
  $('#expense-id').value = exp ? exp.id : '';
  $('#expense-name').value = exp ? exp.name : '';
  $('#expense-amount').value = exp ? exp.amount : '';
  $('#expense-category').value = exp ? exp.category : 'Groceries';
  $('#expense-date').value = exp ? exp.date : iso(today());
  $('#expense-notes').value = exp ? exp.notes || '' : '';
  $('#expense-delete').style.display = exp ? 'inline-flex' : 'none';
  openModal('#expense-modal');
}

function openBudgetModal() {
  $('#budget-modal-month').textContent = monthLabel(dashMonth);
  $('#budget-input').value = state.budgets[dashMonth] || '';
  openModal('#budget-modal');
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
  $('#fund-title').textContent = 'Add money — ' + pot.name;
  $('#fund-sub').textContent = `${fmt(pot.saved)} saved of ${fmt(pot.target)} (${Math.floor((pot.saved / pot.target) * 100)}%)`;
  $('#fund-amount').value = '';
  openModal('#fund-modal');
}

/* ============================== ACTIONS ============================== */

async function saveExpense(ev) {
  ev.preventDefault();
  const id = $('#expense-id').value;
  const body = {
    name: $('#expense-name').value.trim(),
    amount: parseFloat($('#expense-amount').value),
    category: $('#expense-category').value,
    date: $('#expense-date').value,
    notes: $('#expense-notes').value.trim()
  };
  try {
    if (id) {
      await api('PUT', '/api/expenses/' + id, body);
      sfx.success();
      toast('Expense updated!', '✏️');
    } else {
      await api('POST', '/api/expenses', body);
      sfx.success();
      toast('Expense saved!', '💸');
      burst(1);
    }
    closeModal('#expense-modal');
    await reload();
  } catch (err) {
    sfx.error();
    toast(err.message, '⚠️');
  }
}

async function deleteExpense(exp) {
  try {
    await api('DELETE', '/api/expenses/' + exp.id);
    lastDeleted = exp;
    lastDeletedType = 'expense';
    sfx.coin();
    toastUndo();
    await reload();
  } catch (err) { sfx.error(); toast(err.message, '⚠️'); }
}

async function saveBudget(ev) {
  ev.preventDefault();
  const amount = parseFloat($('#budget-input').value);
  if (isNaN(amount) || amount < 0) { sfx.error(); toast('Enter a valid budget', '⚠️'); return; }
  try {
    await api('POST', '/api/budget', { month: dashMonth, amount });
    sfx.success();
    toast(`Budget set to ${fmt(amount)}`, '🎯');
    closeModal('#budget-modal');
    await reload();
  } catch (err) { sfx.error(); toast(err.message, '⚠️'); }
}

async function savePot(ev) {
  ev.preventDefault();
  const id = $('#pot-id').value;
  const body = {
    name: $('#pot-name').value.trim(),
    target: parseFloat($('#pot-target').value),
    saved: parseFloat($('#pot-saved').value) || 0
  };
  if (!id) body.color = randPotColor();
  try {
    if (id) {
      await api('PUT', '/api/pots/' + id, body);
      sfx.success();
      toast('Pot updated!', '✏️');
    } else {
      await api('POST', '/api/pots', body);
      sfx.success();
      toast('New pot created!', '🏺');
      burst(1);
    }
    closeModal('#pot-modal');
    await reload();
  } catch (err) { sfx.error(); toast(err.message, '⚠️'); }
}

async function deletePot(pot) {
  try {
    await api('DELETE', '/api/pots/' + pot.id);
    lastDeleted = pot;
    lastDeletedType = 'pot';
    sfx.coin();
    toastUndo();
    await reload();
  } catch (err) { sfx.error(); toast(err.message, '⚠️'); }
}

async function fundPot(ev) {
  ev.preventDefault();
  const amount = parseFloat($('#fund-amount').value);
  if (isNaN(amount) || amount <= 0) { sfx.error(); toast('Enter a valid amount', '⚠️'); return; }
  try {
    const res = await api('POST', '/api/pots/' + fundPotId + '/fund', { amount });
    const pot = res.pot;
    sfx.coin();
    closeModal('#fund-modal');
    await reload();
    toast(`Added ${fmt(amount)} to "${pot.name}"`, '💰');
    if (pot.saved >= pot.target) burst(1.4);
  } catch (err) { sfx.error(); toast(err.message, '⚠️'); }
}

async function reload() {
  try {
    state = await api('GET', '/api/state');
    renderAll();
  } catch (err) { sfx.error(); toast('Sync failed: ' + err.message, '⚠️'); }
}

/* ============================== DOWNLOADS ============================== */

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadCSV() {
  const monthExp = expensesInMonth(summaryMonth).sort((a, b) => (a.date < b.date ? -1 : 1));
  const rows = [
    ['Date', 'Category', 'Name', 'Amount (RM)', 'Notes'],
    ...monthExp.map((e) => [e.date, e.category, e.name, e.amount.toFixed(2), e.notes || ''])
  ];
  const csv = rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  download(`spendsync-${summaryMonth}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
  sfx.success();
  toast('CSV downloaded!', '📥');
}

function downloadReport() {
  const monthExp = expensesInMonth(summaryMonth).sort((a, b) => (a.date < b.date ? -1 : 1));
  const spent = sum(monthExp);
  const budget = state.budgets[summaryMonth] || 0;
  const byCat = {};
  monthExp.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const daysElapsed = summaryMonth === monthKey(iso(today())) ? Math.max(1, new Date().getDate()) : daysInMonth(summaryMonth);

  const lines = [];
  lines.push('========================================');
  lines.push('   💸 SPENDSYNC — MONTHLY REPORT');
  lines.push('========================================');
  lines.push(`Month:        ${monthLabel(summaryMonth)}`);
  lines.push(`Generated:    ${new Date().toLocaleString('en-MY')}`);
  lines.push('');
  lines.push('--- SUMMARY ---');
  lines.push(`Budget:       ${budget > 0 ? fmt(budget) : 'Not set'}`);
  lines.push(`Total spent:  ${fmt(spent)}`);
  lines.push(`Remaining:    ${budget > 0 ? fmt(budget - spent) : '—'}${budget > 0 && budget - spent < 0 ? ' (OVER BUDGET!)' : ''}`);
  lines.push(`Transactions: ${monthExp.length}`);
  lines.push(`Daily avg:    ${fmt(spent / daysElapsed)}`);
  lines.push('');
  lines.push('--- TOP CATEGORIES ---');
  Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    lines.push(`  ${k.padEnd(18)} ${fmt(v)}`);
  });
  lines.push('');
  lines.push('--- TRANSACTIONS ---');
  if (monthExp.length === 0) {
    lines.push('  (none)');
  } else {
    monthExp.forEach((e) => {
      lines.push(`  [${e.date}] ${e.name} — ${fmt(e.amount)} (${e.category})${e.notes ? ' — ' + e.notes : ''}`);
    });
  }
  lines.push('');
  lines.push('Tracked with 💜 by SpendSync');

  download(`spendsync-report-${summaryMonth}.txt`, lines.join('\r\n'), 'text/plain;charset=utf-8');
  sfx.success();
  toast('Report downloaded!', '📥');
}

/* ============================== EVENTS ============================== */

function switchTab(name) {
  view = name;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-view').forEach((v) => v.classList.toggle('active', v.id === 'tab-' + name));
  $('#fab').style.display = name === 'pots' ? 'none' : 'flex';
  sfx.click();
  if (name === 'pots') renderPots();
  if (name === 'summary') renderSummary();
}

function setupEvents() {
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  $('#prev-month').addEventListener('click', () => { dashMonth = shiftMonth(dashMonth, -1); renderBudget(); renderPeriod(); renderCharts(); renderCategories(); renderExpenses(); sfx.click(); });
  $('#next-month').addEventListener('click', () => { dashMonth = shiftMonth(dashMonth, 1); renderBudget(); renderPeriod(); renderCharts(); renderCategories(); renderExpenses(); sfx.click(); });
  $('#sum-prev').addEventListener('click', () => { summaryMonth = shiftMonth(summaryMonth, -1); renderSummary(); sfx.click(); });
  $('#sum-next').addEventListener('click', () => { summaryMonth = shiftMonth(summaryMonth, 1); renderSummary(); sfx.click(); });

  document.querySelectorAll('.pill').forEach((p) => {
    p.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach((x) => x.classList.toggle('active', x === p));
      period = p.dataset.period;
      renderPeriod();
      sfx.click();
    });
  });

  $('#edit-budget').addEventListener('click', openBudgetModal);
  $('#add-expense-btn').addEventListener('click', () => openExpenseModal(null));
  $('#fab').addEventListener('click', () => openExpenseModal(null));
  $('#add-pot-btn').addEventListener('click', () => openPotModal(null));

  $('#expense-form').addEventListener('submit', saveExpense);
  $('#budget-form').addEventListener('submit', saveBudget);
  $('#pot-form').addEventListener('submit', savePot);
  $('#fund-form').addEventListener('submit', fundPot);

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

  document.querySelectorAll('.quick-chips .chip-btn').forEach((c) => {
    c.addEventListener('click', () => { $('#budget-input').value = c.dataset.amount; sfx.click(); });
  });

  $('#sound-btn').addEventListener('click', () => {
    soundOn = !soundOn;
    localStorage.setItem('ss_sound', soundOn ? 'on' : 'off');
    updateSoundBtn();
    if (soundOn) sfx.success();
  });

  $('#retry-btn').addEventListener('click', () => { $('#offline').style.display = 'none'; $('#splash').style.display = 'flex'; loadState(); });

  $('#download-csv').addEventListener('click', downloadCSV);
  $('#download-report').addEventListener('click', downloadReport);

  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn, .tab, .pill, .icon-btn, .chip-btn, .mini-btn')) sfx.click();
  });

  $('#expense-category').innerHTML = CATEGORIES.map((c) => `<option value="${c.name}">${c.emoji} ${c.name}</option>`).join('');
}

function startClock() {
  const el = $('#clock');
  const tick = () => {
    const d = new Date();
    el.textContent = d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  tick();
  setInterval(tick, 1000);
}

/* ============================== INIT ============================== */

setupEvents();
startClock();
loadState();