'use strict';

/* ============================================================
   SpendSync — state & persistence module (no DOM access).
   Pure data logic + localStorage. UI lives in app.js.
   ============================================================ */

const DATA_KEY = 'spendsync_data_v3';

const CATEGORIES = [
  { name: 'Groceries', emoji: '🛒', color: '#34e0a1', type: 'need' },
  { name: 'Dining Out', emoji: '🍜', color: '#ffb347', type: 'want' },
  { name: 'Personal Care', emoji: '🧴', color: '#ff6b9d', type: 'want' },
  { name: 'Transport', emoji: '🚗', color: '#4cc9f0', type: 'need' },
  { name: 'Bills & Utilities', emoji: '💡', color: '#ffd166', type: 'need' },
  { name: 'Housing', emoji: '🏠', color: '#9b8cff', type: 'need' },
  { name: 'Shopping', emoji: '🛍️', color: '#f472b6', type: 'want' },
  { name: 'Entertainment', emoji: '🎬', color: '#a3e635', type: 'want' },
  { name: 'Health', emoji: '💊', color: '#2dd4bf', type: 'need' },
  { name: 'Education', emoji: '📚', color: '#60a5fa', type: 'need' },
  { name: 'Travel', emoji: '✈️', color: '#38bdf8', type: 'want' },
  { name: 'Family & Kids', emoji: '👨‍👩‍👧', color: '#fbbf24', type: 'need' },
  { name: 'Insurance', emoji: '🛡️', color: '#94a3b8', type: 'need' },
  { name: 'Investments', emoji: '📈', color: '#4ade80', type: 'save' },
  { name: 'Others', emoji: '📦', color: '#cbd5e1', type: 'want' }
];

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
  'Family & Kids': '👨‍👩‍👧',
  'Insurance': '🛡️',
  'Investments': '📈',
  'Others': '📦'
};

const POT_EMOJIS = ['🎯', '🏖️', '📱', '🚗', '✈️', '🏠', '💍', '🎁', '💻', '🎓', '🐱', '🏋️', '🎸', '🚲'];

const INCOME_EMOJIS = ['💰', '💵', '🏦', '🎓', '💼', '📈', '🧧', '🤑'];

const PET_LEVELS = [
  { xp: 0, tag: 'Lil Furball', line: 'Meow! Just a kitten with big dreams.' },
  { xp: 60, tag: 'Curious Kitten', line: 'Purring at every ringgit you save.' },
  { xp: 160, tag: 'Budget Whisker', line: 'Sharp eyes. Sharper budget.' },
  { xp: 320, tag: 'Money Hunter', line: 'Hunts discounts. Guards your wallet.' },
  { xp: 560, tag: 'MONEY BOSS', line: 'THE MONEY BOSS HAS ARRIVED.' }
];

const PET_TIPS = {
  grumpy: ['Rawr… slow down today, human.', 'You call that a budget? Mrrow.', 'Stomach says no to this spending.'],
  worried: ['Meow… keep an eye on the pace.', 'The wallet meows for mercy.', 'Eyes on the ringgit, up up up.'],
  happy: ['On track! Keep going!', 'Purrfect measuring of monies.', 'Treat me with a pot fund later? 😼']
};

const ACHIEVEMENTS = [
  { id: 'first_step', icon: '💸', title: 'First Step', desc: 'Log your first expense', test: () => state.expenses.length >= 1 },
  { id: 'ten_spree', icon: '🧾', title: 'Ten Spree', desc: 'Log 10 transactions', test: () => state.expenses.length >= 10 },
  { id: 'budget_wizard', icon: '🎯', title: 'Budget Wizard', desc: 'Set a monthly budget', test: () => Object.values(state.budgets).some((b) => b > 0) },
  { id: 'payday', icon: '💵', title: 'Payday!', desc: 'Add your first income entry', test: () => state.incomes.length >= 1 },
  { id: 'dreamer', icon: '🏺', title: 'Dreamer', desc: 'Create a saving pot', test: () => state.pots.length >= 1 },
  { id: 'pot_overlord', icon: '🏆', title: 'Pot Overlord', desc: 'Fully fund a saving pot', test: () => state.pots.some((p) => p.target > 0 && p.saved >= p.target) },
  { id: 'hot_streak', icon: '🔥', title: 'Hot Streak', desc: '7 days on pace in a row', test: () => onPaceStreak(monthKey(today())) >= 7 },
  { id: 'frugal_month', icon: '🧊', title: 'Frugal Month', desc: 'Finish a month under budget', test: () => {
    const prev = shiftMonth(monthKey(today()), -1);
    const b = state.budgets[prev] || 0;
    const s = sum(expensesInMonth(prev));
    return b > 0 && s > 0 && s <= b;
  } },
  { id: 'taste_tester', icon: '😊', title: 'Taste Tester', desc: 'Rate your first expense', test: () => state.expenses.some((e) => e.rate >= 1 && e.rate <= 5) },
  { id: 'set_and_forget', icon: '🔁', title: 'Set & Forget', desc: 'Create a recurring tracker', test: () => state.expenses.some((e) => e.repeat) || state.incomes.some((i) => i.repeat) },
  { id: 'cat_max', icon: '👑', title: 'Money Cat Boss', desc: 'Level your cat to the max', test: () => (state.pet.xp || 0) >= PET_LEVELS[PET_LEVELS.length - 1].xp }
];

const cat = (name) => CATEGORIES.find((c) => c.name === name) || { name, emoji: '📦', color: '#cbd5e1', type: 'want' };

/* ============================== HELPERS ============================== */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function pad(n) { return String(n).padStart(2, '0'); }
function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function today() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function monthKey(d) { return (typeof d === 'string' ? d : iso(d)).slice(0, 7); }
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
  return 'RM ' + (Number(n) || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
function incomesInMonth(key) {
  return state.incomes.filter((i) => i.date && i.date.startsWith(key));
}
function incomeForMonth(key) {
  return sum(incomesInMonth(key));
}
function sum(list) { return list.reduce((a, e) => a + (Number(e.amount) || 0), 0); }
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

/* ============================== BUDGET IMPACT ============================== */

/**
 * Tags a category as 'capital' (large, planned, lumpy costs like tuition,
 * bills, investments) or 'daily' (living costs). Capital items never break
 * the daily pace; both count in monthly cashflow.
 */
function categorizeExpense(category) {
  const CAPITAL = new Set(['Education', 'Investments', 'Bills', 'Bills & Utilities', 'Insurance', 'Housing']);
  const key = String(category || 'Others');
  return CAPITAL.has(key) ? 'capital' : 'daily';
}

/**
 * Sums only budgetImpact === 'daily' transactions.
 * Returns remaining allowance (negative when overspent).
 */
function calculateDailyPace(transactions, dailyAllowance) {
  const dailySpent = transactions
    .filter((t) => t && (t.budgetImpact || categorizeExpense(t.category)) === 'daily')
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  return (Number(dailyAllowance) || 0) - dailySpent;
}

/**
 * Total income minus ALL expenses (daily AND capital).
 */
function calculateMonthlyCashflow(transactions, income) {
  const totalSpent = transactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  return (Number(income) || 0) - totalSpent;
}

function groupByCategory(transactions) {
  const map = new Map();
  transactions.forEach((t) => {
    if (!map.has(t.category)) map.set(t.category, []);
    map.get(t.category).push(t);
  });
  return [...map.entries()]
    .map(([category, list]) => ({
      category,
      transactions: list,
      total: sum(list),
      count: list.length
    }))
    .sort((a, b) => b.total - a.total);
}

/* ============================== STATE ============================== */

function normalizeState(raw) {
  const d = raw || {};
  const state = {
    budgets: d.budgets || {},
    expenses: (d.expenses || []).map((e) => Object.assign({
      id: e.id || uid(),
      createdAt: e.createdAt || new Date().toISOString(),
      repeat: false,
      rate: 0,
      budgetImpact: categorizeExpense(e.category)
    }, e)),
    pots: (d.pots || []).map((p) => Object.assign({ id: p.id || uid(), createdAt: p.createdAt || new Date().toISOString() }, p)),
    incomes: (d.incomes || []).map((i) => Object.assign({ id: i.id || uid(), createdAt: i.createdAt || new Date().toISOString() }, i)),
    pet: d.pet || { xp: 0 },
    awards: Array.isArray(d.awards) ? d.awards : []
  };
  // Ensure budgetImpact is present on legacy entries.
  state.expenses.forEach((e) => {
    if (!e.budgetImpact) e.budgetImpact = categorizeExpense(e.category);
  });
  // Migrate legacy flat income map { 'YYYY-MM': amount } into entries.
  if (d.income && typeof d.income === 'object' && !d.incomes) {
    Object.entries(d.income).forEach(([k, v]) => {
      if (!(v > 0)) return;
      const has = state.incomes.some((i) => i.date && i.date.startsWith(k));
      if (!has) state.incomes.push({ id: uid(), createdAt: new Date().toISOString(), name: 'Salary', emoji: '💰', amount: v, date: k + '-01', repeat: false });
    });
  }
  return state;
}

function loadData() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch (e) { /* corrupted storage -> start fresh */ }
  return normalizeState({});
}

function saveData() {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(state));
  } catch (e) {
    if (typeof toast === 'function') toast('Could not save — storage is full or blocked.', '⚠️');
  }
}

let state = loadData();

/* ============================== RECURRING ============================== */

function rollRecurring(targetKey) {
  let moved = 0;
  const prevKey = shiftMonth(targetKey, -1);
  state.incomes.forEach((i) => {
    if (!i.repeat || !i.date) return;
    if (monthKey(i.date) !== prevKey) return;
    i.date = targetKey + '-' + pad(Math.min(Number(i.date.slice(8, 10)) || 1, daysInMonth(targetKey)));
    moved++;
  });
  state.expenses.forEach((e) => {
    if (!e.repeat || !e.date) return;
    if (monthKey(e.date) !== prevKey) return;
    e.date = targetKey + '-' + pad(Math.min(Number(e.date.slice(8, 10)) || 1, daysInMonth(targetKey)));
    moved++;
  });
  return moved;
}

/* ============================== STREAK ============================== */

// Consecutive days (ending today) where cumulative DAILY spending stayed
// at or under the budget pace. Capital items never break the streak.
function onPaceStreak(key) {
  const budget = state.budgets[key] || 0;
  if (budget <= 0) return 0;
  const days = daysInMonth(key);
  const todayNum = new Date().getDate();
  const monthStart = key + '-01';
  let streak = 0;
  for (let d = todayNum; d >= 1; d--) {
    const dayStr = key + '-' + pad(d);
    const dailyTxns = expensesInRange(monthStart, dayStr).filter((e) => (e.budgetImpact || categorizeExpense(e.category)) === 'daily');
    const cum = sum(dailyTxns);
    const pace = budget * (d / days);
    if (cum <= pace) streak++;
    else break;
  }
  return streak;
}

/* ============================== PET ============================== */

function petLevel(xp) {
  let lv = 0;
  for (let i = 0; i < PET_LEVELS.length; i++) if (xp >= PET_LEVELS[i].xp) lv = i;
  return lv;
}

function petXpInfo() {
  const xp = state.pet.xp || 0;
  const lv = petLevel(xp);
  const cur = PET_LEVELS[lv];
  const next = PET_LEVELS[lv + 1];
  const pct = next ? Math.min(100, ((xp - cur.xp) / (next.xp - cur.xp)) * 100) : 100;
  return { xp, lv, tag: cur.tag, line: cur.line, next, pct };
}

function petMood(key) {
  const budget = state.budgets[key] || 0;
  const income = incomeForMonth(key);
  const dailySpent = sum(expensesInMonth(key).filter((e) => (e.budgetImpact || categorizeExpense(e.category)) === 'daily'));
  if (budget > 0 && dailySpent > budget) return 'grumpy';
  if (income > 0 && sum(expensesInMonth(key)) > income) return 'grumpy';
  if (budget > 0 && dailySpent > budget * 0.85) return 'worried';
  return 'happy';
}

function petTip(mood) {
  const arr = PET_TIPS[mood] || PET_TIPS.happy;
  return arr[Math.floor(Math.random() * arr.length)];
}

function addPetXp(n) {
  const before = petLevel(state.pet.xp || 0);
  state.pet.xp = (state.pet.xp || 0) + n;
  const after = petLevel(state.pet.xp);
  if (after > before) {
    saveData();
    if (typeof burst === 'function') burst(1.5);
    if (typeof toast === 'function') toast(`🐱 Level up! Duit is now ${PET_LEVELS[after].tag}!`, '⭐');
  }
}
