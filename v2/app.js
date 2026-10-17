'use strict';

/* ============================================================
   SpendSync v2 — DOM wiring (tab switching + category drill-down)
   Pure data logic lives in state.js.
   ============================================================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const TODAY = new Date().toISOString().slice(0, 10);
const CAT_EMOJI = {
  'Dining Out': '🍜',
  'Groceries': '🛒',
  'Personal Care': '🧴',
  'Transport': '🚗',
  'Bills & Utilities': '💡',
  'Housing': '🏠',
  'Shopping': '🛍️',
  'Entertainment': '🎬',
  'Health': '💊',
  'Education': '📚',
  'Travel': '✈️',
  'Insurance': '🛡️',
  'Investments': '📈',
  'Others': '📦'
};

const fmt = (n) => 'RM ' + n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ============================================================
   Tab switching (progressive disclosure, no reload)
   ============================================================ */

function switchTab(name) {
  $$('.nav-item').forEach((b) => {
    const active = b.dataset.tab === name;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  $$('.tab-view').forEach((v) => {
    const active = v.id === 'tab-' + name;
    v.classList.toggle('active', active);
    v.hidden = !active;
  });
  if (name === 'home') renderHome();
  if (name === 'analytics') renderAnalytics();
  if (name === 'budget') renderBudget();
}

/* ============================================================
   Home: allowance + today's transactions
   ============================================================ */

function renderHome() {
  const todayTxns = SAMPLE_TRANSACTIONS.filter((t) => t.date === TODAY);
  const remaining = calculateDailyPace(todayTxns, DAILY_ALLOWANCE);

  $('#home-allowance').textContent = Math.max(0, remaining).toFixed(2);
  $('#home-allowance').style.color = remaining < 0 ? 'var(--danger)' : 'var(--text)';

  const used = DAILY_ALLOWANCE - remaining;
  const pct = Math.min(100, Math.max(0, (used / DAILY_ALLOWANCE) * 100));
  const fill = $('#home-pace-fill');
  fill.style.width = pct + '%';
  fill.style.background = pct > 100
    ? 'linear-gradient(90deg, #ff5c7a, #ff2d55)'
    : pct > 75
      ? 'linear-gradient(90deg, #ffc24b, #ff9f43)'
      : 'linear-gradient(90deg, var(--cyan), var(--accent))';

  $('#home-used').textContent = fmt(used) + ' used today';
  $('#home-left').textContent = remaining >= 0 ? fmt(remaining) + ' left today' : 'Over by ' + fmt(-remaining);

  $('#home-count').textContent = todayTxns.length + ' transaction' + (todayTxns.length === 1 ? '' : 's');
  $('#home-list').innerHTML = todayTxns.length
    ? todayTxns.map(txnItem).join('')
    : '<p class="txn-empty">Nothing today yet. Enjoy the quiet.</p>';
}

function txnItem(t) {
  return `<div class="txn-item">
    <div class="txn-ico">${CAT_EMOJI[t.category] || '📦'}</div>
    <div class="txn-main">
      <div class="txn-name">${esc(t.name)}</div>
      <div class="txn-sub">${esc(t.category)}${t.budgetImpact === 'capital' ? ' · capital' : ''}</div>
    </div>
    <div class="txn-amt ${t.budgetImpact}">${fmt(t.amount)}</div>
  </div>`;
}

/* ============================================================
   Analytics: category grid + drill-down sheet
   ============================================================ */

function renderAnalytics() {
  const groups = groupByCategory(SAMPLE_TRANSACTIONS);
  const max = groups.length ? groups[0].total : 0;
  $('#category-grid').innerHTML = groups.map((g) => {
    const pct = max ? Math.round((g.total / max) * 100) : 0;
    return `<button class="cat-card" data-category="${esc(g.category)}">
      <div class="cat-emoji">${CAT_EMOJI[g.category] || '📦'}</div>
      <div class="cat-name">${esc(g.category)}</div>
      <div class="cat-total">${fmt(g.total)}</div>
      <div class="cat-count">${g.count} transaction${g.count === 1 ? '' : 's'} · ${pct}% of top</div>
    </button>`;
  }).join('');
}

function openCategorySheet(category) {
  const group = groupByCategory(SAMPLE_TRANSACTIONS).find((g) => g.category === category);
  if (!group) return;
  const avg = group.total / group.count;

  $('#sheet-title').textContent = category + ' ' + (CAT_EMOJI[category] || '');
  $('#sheet-total').textContent = fmt(group.total);
  $('#sheet-count').textContent = group.count;
  $('#sheet-avg').textContent = fmt(avg);
  $('#sheet-list').innerHTML = group.transactions.map(txnItem).join('');

  $('#sheet-backdrop').hidden = false;
  requestAnimationFrame(() => {
    $('#sheet-backdrop').classList.add('show');
    $('#category-sheet').classList.add('open');
  });
  document.body.classList.add('sheet-open');
  $('#sheet-close').focus();
}

function closeCategorySheet() {
  $('#sheet-backdrop').classList.remove('show');
  $('#category-sheet').classList.remove('open');
  document.body.classList.remove('sheet-open');
  setTimeout(() => { $('#sheet-backdrop').hidden = true; }, 350);
}

/* ============================================================
   Budget tab
   ============================================================ */

function renderBudget() {
  $('#budget-income').textContent = fmt(SAMPLE_INCOME);
  $('#budget-fixed').textContent = fmt(800);
  const cashflow = calculateMonthlyCashflow(SAMPLE_TRANSACTIONS, SAMPLE_INCOME);
  const flame = $('#budget-flame');
  if (flame) {
    flame.textContent = cashflow >= 0
      ? '🔥 ' + fmt(cashflow) + ' net this month'
      : '🧯 ' + fmt(-cashflow) + ' overspent';
  }
}

/* ============================================================
   Events
   ============================================================ */

function setupEvents() {
  $$('.nav-item').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  $('#category-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.cat-card');
    if (card) openCategorySheet(card.dataset.category);
  });

  $('#sheet-close').addEventListener('click', closeCategorySheet);
  $('#sheet-backdrop').addEventListener('click', closeCategorySheet);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#category-sheet').classList.contains('open')) closeCategorySheet();
  });
}

/* ============================================================
   Init
   ============================================================ */

setupEvents();
renderHome();
renderAnalytics();
renderBudget();
