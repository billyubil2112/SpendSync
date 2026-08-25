'use strict';

/* ============================== CONSTANTS ============================== */

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
const POT_EMOJIS = ['🎯', '🏖️', '📱', '🚗', '✈️', '🏠', '💍', '🎁', '💻', '🎓', '🐱', '🏋️', '🎸', '🚲'];

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

const PET_LEVELS = [
  { xp: 0, tag: 'Lil Furball', line: 'Meow! Just a kitten with big dreams.' },
  { xp: 60, tag: 'Curious Kitten', line: 'Purring at every ringgit you save.' },
  { xp: 160, tag: 'Budget Whisker', line: 'Sharp eyes. Sharper budget.' },
  { xp: 320, tag: 'Money Hunter', line: 'Hunts discounts. Guards your wallet.' },
  { xp: 560, tag: 'MONEY BOSS', line: 'THE MONEY BOSS HAS ARRIVED.' }
];

const INCOME_EMOJIS = ['💰', '💵', '🏦', '🎓', '💼', '📈', '🧧', '🤑'];

const PET_NAMES_TIPS = [
  { mood: 'grumpy', tips: ['Rawr… slow down today, human.', 'You call that a budget? Mrrow.', 'Stomach says no to this spending.'] },
  { mood: 'worried', tips: ['Meow… keep an eye on the pace.', 'The wallet meows for mercy.', 'Eyes on the ringgit, up up up.'] },
  { mood: 'happy', tips: ['On track! Keep going!', 'Purrfect measuring of monies.', 'Treat me with a pot fund later? 😼'] }
];

const cat = (name) => CATEGORIES.find((c) => c.name === name) || { name, emoji: '📦', color: '#cbd5e1', type: 'want' };

/* ============================== STATE ============================== */

const DATA_KEY = 'spendsync_data_v3';

function normalizeState(raw) {
  const d = raw || {};
  const state = {
    budgets: d.budgets || {},
    expenses: (d.expenses || []).map((e) => Object.assign({ id: e.id || uid(), createdAt: e.createdAt || new Date().toISOString(), repeat: false, rate: 0 }, e)),
    pots: (d.pots || []).map((p) => (Object.assign({ id: p.id || uid(), createdAt: p.createdAt || new Date().toISOString() }, p))),
    incomes: (d.incomes || []).map((i) => Object.assign({ id: i.id || uid(), createdAt: i.createdAt || new Date().toISOString() }, i)),
    pet: d.pet || { xp: 0 },
    awards: Array.isArray(d.awards) ? d.awards : []
  };
  // migrate legacy flat income map { 'YYYY-MM': amount } into entries
  if (d.income && typeof d.income === 'object' && !d.incomes) {
    Object.entries(d.income).forEach(([k, v]) => {
      if (!(v > 0)) return;
      const has = state.incomes.some((i) => i.date && i.date.startsWith(k));
      if (!has) state.incomes.push({ id: uid(), createdAt: new Date().toISOString(), name: 'Salary', emoji: '💰', amount: v, date: k + '-01', repeat: false });
    });
    delete d.income;
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
    toast('Could not save — storage is full or blocked.', '⚠️');
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

let state = loadData();
let view = 'dashboard';
let dashMonth = monthKey(today());
let summaryMonth = monthKey(today());
let period = 'day';
let fundPotId = null;
let lastDeleted = null;
let lastDeletedType = null;

let pieChart = null;
let barChart = null;
let yearChart = null;
let year = new Date().getFullYear();

const centerText = {
  id: 'centerText',
  afterDraw(chart, args, opts) {
    if (!opts || opts.hide) return;
    const { ctx, chartArea } = chart;
    if (!chartArea || !chartArea.width) return;
    const x = chartArea.left + chartArea.width / 2;
    const y = chartArea.top + chartArea.height / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(244,247,255,0.96)';
    ctx.fillText(opts.value || '', x, y - 9);
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(244,247,255,0.6)';
    ctx.fillText(opts.label || '', x, y + 14);
    ctx.restore();
  }
};

/* ============================== UTILS ============================== */

const $ = (sel) => document.querySelector(sel);

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

/* ============================== INCOME ============================== */

function incomesInMonth(key) {
  return state.incomes.filter((i) => i.date && i.date.startsWith(key));
}

function incomeForMonth(key) {
  return sum(incomesInMonth(key));
}

/* ============================== RECURRING ============================== */

// Returns { type: 'income'|'expense', item, targetKey } for every recurring
// entry whose month-parity says it should appear in `key`.
function recurringFor(key) {
  const out = [];
  state.incomes.forEach((i) => {
    if (!i.repeat || !i.date) return;
    if (monthOf(i.date) === key) out.push({ type: 'income', item: i });
  });
  state.expenses.forEach((e) => {
    if (!e.repeat || !e.date) return;
    if (monthOf(e.date) === key) out.push({ type: 'expense', item: e });
  });
  return out;
}

// Moves the "anchor" of a recurring entry forward one month (used when the
// user navigates to the next month — recurring items follow along).
function rollRecurring() {
  let moved = 0;
  const newKey = dashMonth;
  const prevKey = shiftMonth(dashMonth, -1);
  state.incomes.forEach((i) => {
    if (!i.repeat || !i.date) return;
    if (monthOf(i.date) !== prevKey) return;
    i.date = newKey + '-' + pad(Math.min(Number(i.date.slice(8, 10)) || 1, daysInMonth(newKey)));
    moved++;
  });
  state.expenses.forEach((e) => {
    if (!e.repeat || !e.date) return;
    if (monthOf(e.date) !== prevKey) return;
    e.date = newKey + '-' + pad(Math.min(Number(e.date.slice(8, 10)) || 1, daysInMonth(newKey)));
    moved++;
  });
  return moved;
}

function monthOf(d) { return d.slice(0, 7); }

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

/* ============================== PET ============================== */

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
  const blush = `<g fill="rgba(232,80,58,0.28)"><ellipse cx="62" cy="99" rx="7" ry="4.5"/><ellipse cx="138" cy="99" rx="7" ry="4.5"/></g>`;
  const happyEyes = `<g stroke="${dark}" stroke-width="4.5" stroke-linecap="round" fill="none"><path d="M72 ${eyeY} q8 -9 16 0"/><path d="M112 ${eyeY} q8 -9 16 0"/></g>`;
  const happyMouth = `<g><path d="M90 103 q10 12 20 0" stroke="${dark}" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M94 108 q6 6 12 0 q-1 3.5 -6 3.5 q-5 0 -6 -3.5" fill="#ff8a9e"/></g>`;
  const headY = adult ? 82 : 88;
  const head = `<circle cx="100" cy="${headY}" r="46" fill="${fur}"/>`;
  return `<svg viewBox="0 0 200 204" xmlns="http://www.w3.org/2000/svg">
  ${sparkles}${crown}${tail}${body}${paws}<g>${ear}${head}${whiskers}${blush}${collar}<g class="cat-face-normal">${eyes}${bangs}${mouth}${sweat}</g><g class="cat-face-happy">${happyEyes}${happyMouth}</g></g>
  <ellipse cx="138" cy="26" rx="2.6" ry="5" fill="${inner}" transform="rotate(-28 138 26)" opacity="0.65"/></svg>`;
}

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
  const into = xp - cur.xp;
  const span = next ? next.xp - cur.xp : 1;
  const pct = next ? Math.min(100, (into / span) * 100) : 100;
  return { xp, lv, tag: cur.tag, line: cur.line, next, pct };
}

function petMood(key) {
  const budget = state.budgets[key] || 0;
  const spent = sum(expensesInMonth(key));
  const income = incomeForMonth(key);
  if (budget > 0 && spent > budget) return 'grumpy';
  if (income > 0 && spent > income) return 'grumpy';
  if (budget > 0 && spent > budget * 0.85) return 'worried';
  return 'happy';
}

function petTip(mood) {
  const arr = PET_NAMES_TIPS[mood] || PET_NAMES_TIPS.happy;
  return arr[Math.floor(Math.random() * arr.length)];
}

function addPetXp(n) {
  const before = petLevel(state.pet.xp || 0);
  state.pet.xp = (state.pet.xp || 0) + n;
  const after = petLevel(state.pet.xp);
  if (after > before) {
    saveData();
    sfx.success();
    burst(1.5);
    toast(`🐱 Level up! Duit is now ${PET_LEVELS[after].tag}!`, '⭐');
  }
}

// Trigger a happy animation on the tapped cat: squash-stretch + wag + hearts.
function petReaction(svgEl) {
  svgEl.classList.remove('petted');
  void svgEl.offsetWidth;
  svgEl.classList.add('petted');
  if (svgEl._pettedTimer) clearTimeout(svgEl._pettedTimer);
  svgEl._pettedTimer = setTimeout(() => svgEl.classList.remove('petted'), 750);
  const host = svgEl.closest('.pet-card') || svgEl.closest('.cat-svg-wrap');
  const hearts = ['❤️', '🐟', '⭐', '💛'];
  for (let i = 0; i < 4; i++) {
    const h = document.createElement('span');
    h.className = 'pet-heart';
    h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    h.style.left = 20 + Math.random() * 60 + '%';
    h.style.bottom = 24 + Math.random() * 40 + '%';
    h.style.animationDelay = Math.random() * 0.3 + 's';
    h.style.fontSize = 0.8 + Math.random() * 0.7 + 'rem';
    host.appendChild(h);
    setTimeout(() => h.remove(), 1500);
  }
}

/* ============================== ACHIEVEMENTS ============================== */

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

function renderPetWidget() {
  const key = dashMonth;
  const info = petXpInfo();
  const mood = petMood(key);
  const s = state.budgets[key] || 0;
  const spent = sum(expensesInMonth(key));
  const inc = incomeForMonth(key);
  const net = inc - spent > 0;
  const meta = s > 0 ? `${Math.round((spent / s) * 100)}% of budget used` : inc > 0 ? 'No budget set yet' : 'Set a budget to wake Duit up';

  $('#pet-tag').textContent = info.tag;
  $('#pet-line').textContent = info.line;
  $('#pet-meta').textContent = meta + (inc > 0 ? ` · net ${net ? '+' : ''}${fmt(inc - spent)}` : '');
  $('#pet-lv').textContent = 'LV ' + (info.lv + 1) + '/' + PET_LEVELS.length;
  $('#pet-xp-fill').style.width = info.pct + '%';
  $('#pet-svg').innerHTML = catSVG(info.lv, mood);
}

/* ============================== BOOTSTRAP ============================== */

function boot() {
  $('#splash').style.display = 'none';
  $('#app').style.display = 'block';
  renderAll();
  sfx.open();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
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
  renderPetWidget();
  checkAchievements();
}

function renderBudget() {
  const budget = state.budgets[dashMonth] || 0;
  const income = incomeForMonth(dashMonth);
  const spent = sum(expensesInMonth(dashMonth));
  const left = budget - spent;
  const net = income - spent;
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
  const netEl = $('#stat-net');
  if (income > 0) {
    netEl.textContent = fmt(net);
    netEl.className = 'hs-value ' + (net >= 0 ? 'good' : 'bad');
  } else {
    netEl.textContent = '—';
    netEl.className = 'hs-value';
  }
  const incLine = $('#income-line');
  incLine.textContent = income > 0 ? 'Income ' + fmt(income) + ' · ' + (net >= 0 ? 'saved ' + fmt(net) : 'overspent ' + fmt(-net)) : 'Add income to see your net savings.';
  incLine.style.color = income > 0 ? (net >= 0 ? 'var(--accent)' : 'var(--danger)') : '';
  renderPace();
  renderStreakChips();
  renderSplit();

  const circ = 2 * Math.PI * 52;
  const pct = budget > 0 ? Math.min(200, (spent / budget) * 100) : (spent > 0 ? 100 : 0);
  const ring = $('#budget-ring-fg');
  ring.style.strokeDasharray = circ;
  ring.style.strokeDashoffset = circ * (1 - Math.min(1, pct / 100));
  $('#budget-pct').textContent = Math.round(Math.min(pct, 999)) + '%';
  ring.style.stroke = pct > 100 ? 'var(--danger)' : pct > 75 ? 'var(--warn)' : 'var(--accent)';
}

function renderPace() {
  const budget = state.budgets[dashMonth] || 0;
  const days = daysInMonth(dashMonth);
  const todayNum = new Date().getDate();
  const isCur = dashMonth === monthKey(iso(today()));
  const daysLeft = isCur ? days - todayNum + 1 : days;
  const spent = sum(expensesInMonth(dashMonth));
  const elapsed = isCur ? todayNum : days;
  const avg = elapsed ? spent / elapsed : 0;
  const allowPerDay = budget > 0 ? budget / days : 0;
  const pace = Math.max(0, allowPerDay - avg);
  const fill = budget > 0 ? Math.min(100, (avg / allowPerDay) * 100) : 0;
  const bar = $('#pace-bar-fill');
  const num = $('#pace-num');
  const cap = $('#pace-cap');
  bar.style.width = (budget > 0 ? fill : 0) + '%';
  bar.style.background = !budget || fill < 70 ? 'var(--accent)' : fill <= 100 ? 'linear-gradient(90deg,#ffd166,#ffb347)' : 'linear-gradient(90deg,#ff8a5b,#ff5c5c)';
  if (!budget) { num.textContent = '—'; cap.textContent = 'Set a budget to see your daily pace'; return; }
  num.textContent = fmt(pace);
  cap.textContent = `left per day if you keep up · ${Math.round(fill)}% of allowance used today`;
}

function renderSplit() {
  const budget = state.budgets[dashMonth] || 0;
  const income = incomeForMonth(dashMonth);
  const spent = sum(expensesInMonth(dashMonth));
  if (income <= 0 && budget <= 0) { $('#split-box').innerHTML = '<div class="empty-state" style="padding:16px 6px"><span class="big">🌱</span>Add income and a budget to see your 50/30/20 split.</div>'; return; }
  const goal = income > 0 ? income : budget;
  const needs = Math.round(goal * 0.5);
  const wants = Math.round(goal * 0.3);
  const saves = Math.round(goal * 0.2);
  const monthExp = expensesInMonth(dashMonth);
  const spentNeed = sum(monthExp.filter((e) => cat(e.category).type === 'need'));
  const spentWant = sum(monthExp.filter((e) => cat(e.category).type === 'want'));
  const spentSave = Math.max(0, income - spent);
  const rows = [
    { icon: '🏠', label: 'Needs', alloc: needs, spent: spentNeed, color: '#4cc9f0' },
    { icon: '🎈', label: 'Wants', alloc: wants, spent: spentWant, color: '#ff6b9d' },
    { icon: '🐱', label: 'Savings', alloc: saves, spent: spentSave, color: '#ffd166' }
  ];
  $('#split-box').innerHTML = rows.map((r) => {
    const pct = r.alloc > 0 ? Math.min(100, (r.spent / r.alloc) * 100) : 0;
    const over = r.spent > r.alloc;
    const save = r.label === 'Savings';
    const bad = over && !save;
    const extra = bad ? ' <span class="split-over">· over!</span>' : save && over ? ' <span class="split-over good">· solid!</span>' : '';
    const glow = bad ? 'box-shadow:0 0 10px ' + r.color : '';
    return `<div class="split-row">
      <div class="split-head">
        <span>${r.icon} ${r.label}</span>
        <span>${fmt(r.spent)} / <b>${fmt(r.alloc)}</b>${extra}</span>
      </div>
      <div class="split-bar"><i style="width:${pct}%;background:${r.color};${glow}"></i></div>
    </div>`;
  }).join('');
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
          centerText: { value: fmt(sum(monthExp)), label: 'spent this month' },
          legend: { position: 'right', labels: { color: 'rgba(244,247,255,0.85)', font: { family: 'Plus Jakarta Sans', size: 12 }, boxWidth: 10, padding: 14 } }
        }
      },
      plugins: [centerText]
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
    const flags = [
      e.repeat ? '<span class="exp-flag" title="Repeats monthly">🔁</span>' : '',
      e.rate ? `<span class="exp-flag" title="${RATE_LABELS[e.rate]}">${RATE_EMOJIS[e.rate]}</span>` : ''
    ].join('');
    return `<div class="expense-item" style="animation-delay:${Math.min(i, 20) * 30}ms">
      <div class="exp-icon" style="background:${c.color}22">${c.emoji}</div>
      <div class="exp-main">
        <div class="exp-name">${esc(e.name)} ${flags}<span class="exp-tag" style="color:${c.color};background:${c.color}1a">${esc(e.category)}</span></div>
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
  const income = incomeForMonth(summaryMonth);
  const net = income - spent;
  const rated = monthExp.filter((e) => e.rate >= 1 && e.rate <= 5);
  const score = rated.length ? Math.round((rated.reduce((a, e) => a + e.rate, 0) / rated.length) * 10) / 10 : 0;
  const byCat = {};
  monthExp.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const todayNum = new Date().getDate();
  const isCur = summaryMonth === monthKey(iso(today()));
  const daysElapsed = isCur ? Math.min(todayNum, daysInMonth(summaryMonth)) : daysInMonth(summaryMonth);
  const dailyAvg = daysElapsed ? spent / daysElapsed : 0;

  // Compare vs last month
  const prevKey = shiftMonth(summaryMonth, -1);
  const prevSpent = sum(expensesInMonth(prevKey));
  let compare;
  if (prevSpent <= 0) {
    compare = { text: '—', cls: '' };
  } else if (spent <= 0) {
    compare = { text: '▼ 100%', cls: 'good' };
  } else {
    const chg = ((spent - prevSpent) / prevSpent) * 100;
    compare = { text: (chg >= 0 ? '▲ ' : '▼ ') + Math.round(Math.abs(chg)) + '%', cls: chg > 0 ? 'bad' : 'good' };
  }

  // Forecast month-end
  const projected = Math.round(dailyAvg * daysInMonth(summaryMonth));
  let projSub = 'on current pace';
  if (budget > 0) projSub += ' · ' + (projected > budget ? '⏫ ' : 'ok ') + fmt(Math.abs(projected - budget)) + (projected > budget ? ' over' : ' under');

  const stats = [
    { label: 'Total spent', value: fmt(spent), sub: monthExp.length + ' transactions' },
    { label: 'Income', value: income > 0 ? fmt(income) : '—', sub: income > 0 ? incomesInMonth(summaryMonth).length + ' source(s)' : 'not set' },
    { label: 'Net savings', value: income > 0 ? fmt(net) : '—', cls: income > 0 ? (net >= 0 ? 'good' : 'bad') : '', sub: income > 0 ? 'income − spent' : 'set income to track' },
    { label: 'Budget', value: budget > 0 ? fmt(budget) : '—', sub: budget > 0 ? Math.round((spent / budget) * 100) + '% used' : 'not set' },
    { label: 'Remaining', value: budget > 0 ? fmt(budget - spent) : '—', sub: budget - spent < 0 ? 'over budget' : 'of budget' },
    { label: 'Daily average', value: fmt(dailyAvg), sub: 'per day so far' },
    { label: 'vs last month', value: compare.text, cls: compare.cls, sub: monthLabel(prevKey) },
    { label: 'Projected month-end', value: fmt(projected), sub: projSub },
    { label: 'Value score', value: rated.length ? score.toFixed(1) + ' / 5' : '—', sub: rated.length ? rateEmoji(score) + ' from ' + rated.length + ' rating(s)' : 'rate expenses to unlock' },
    { label: 'Top category', value: top ? top[0] : '—', sub: top ? fmt(top[1]) : '' }
  ];
  $('#sum-stats').innerHTML = stats.map((s, i) => `
    <div class="stat-card glass" style="animation-delay:${i * 40}ms">
      <div class="sc-label">${s.label}</div>
      <div class="sc-value ${s.cls || ''}">${s.value}</div>
      <div class="sc-sub">${s.sub}</div>
    </div>`).join('');

  renderYearChart();

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

function renderYearChart() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const labels = [];
  const spentArr = [];
  const budgArr = [];
  let anySpent = false;
  let anyBudg = false;
  for (let m = 0; m < 12; m++) {
    const key = year + '-' + pad(m + 1);
    labels.push(months[m]);
    const s = sum(expensesInMonth(key));
    const b = state.budgets[key] || 0;
    spentArr.push(s);
    if (s > 0) anySpent = true;
    if (b > 0) { budgArr.push(b); anyBudg = true; } else { budgArr.push(null); }
  }
  $('#year-label').textContent = year;
  const emptyEl = $('#year-empty');
  const canvas = $('#year-chart');
  if (!anySpent) {
    if (yearChart) { yearChart.destroy(); yearChart = null; }
    canvas.style.display = 'none';
    emptyEl.style.display = 'block';
    return;
  }
  canvas.style.display = 'block';
  emptyEl.style.display = 'none';
  if (yearChart) { yearChart.destroy(); yearChart = null; }
  const datasets = [{
    type: 'bar',
    label: 'Spent',
    data: spentArr,
    backgroundColor: spentArr.map((v, i) => (v > 0 ? 'rgba(52,224,161,0.8)' : 'rgba(255,255,255,0.05)')),
    borderRadius: 4,
    borderSkipped: false,
    yAxisID: 'y'
  }];
  if (anyBudg) {
    datasets.push({
      type: 'line',
      label: 'Budget',
      data: budgArr,
      borderColor: 'rgba(255,183,77,0.9)',
      backgroundColor: 'rgba(255,183,77,0.15)',
      borderWidth: 2,
      pointRadius: 3,
      tension: 0.35,
      fill: true,
      spanGaps: true,
      yAxisID: 'y'
    });
  }
  yearChart = new Chart(canvas, {
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: 'rgba(244,247,255,0.85)', font: { family: 'Plus Jakarta Sans', size: 12 }, boxWidth: 10, usePointStyle: true } },
        tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + fmt(c.parsed.y) } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: 'rgba(244,247,255,0.5)', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(244,247,255,0.6)', font: { size: 11 }, callback: (v) => 'RM' + v } }
      }
    }
  });
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

const RATE_EMOJIS = ['', '😭', '😕', '😐', '🙂', '🥰'];
const RATE_LABELS = ['', 'regret', 'meh', 'eh, ok', 'worth it', 'loved it'];

function rateEmoji(score) {
  return RATE_EMOJIS[Math.round(score)] || '😐';
}

// Consecutive days (ending today, inside the current month) where the
// cumulative spending stayed at or under the budget pace.
function onPaceStreak(key) {
  const budget = state.budgets[key] || 0;
  if (budget <= 0) return 0;
  const days = daysInMonth(key);
  const todayNum = new Date().getDate();
  const monthStart = key + '-01';
  let streak = 0;
  for (let d = todayNum; d >= 1; d--) {
    const dayStr = key + '-' + pad(d);
    const cum = sum(expensesInRange(monthStart, dayStr));
    const pace = budget * (d / days);
    if (cum <= pace) streak++;
    else break;
  }
  return streak;
}

function renderStreakChips() {
  const key = dashMonth;
  const isCur = key === monthKey(iso(today()));
  const streak = isCur ? onPaceStreak(key) : 0;
  const chips = $('#pace-chips');
  if (!isCur) { chips.style.display = 'none'; return; }
  chips.style.display = 'flex';
  $('#streak-num').textContent = streak;
  $('#streak-chip').classList.toggle('hot', streak >= 5);
  $('#streak-chip').classList.toggle('ice', streak === 0);
}

/* ============================== MODALS ============================== */

function openModal(id) {
  const modal = $(id);
  modal.classList.add('open');
  sfx.open();
  const focusable = modal.querySelector('input, select, textarea, button');
  setTimeout(() => { if (focusable) focusable.focus(); }, 60);
}

function closeModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.classList.remove('open');
  const focusable = modal.querySelector('input, select, textarea, button');
  if (focusable) focusable.blur();
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = document.querySelector('.modal.open');
  if (open) closeModal('#' + open.id);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const open = document.querySelector('.modal.open');
  if (!open) return;
  const focusables = [...open.querySelectorAll('input, select, textarea, button, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled);
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

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
  $('#expense-repeat').checked = exp ? !!exp.repeat : false;
  $('#expense-rate-val').value = exp && exp.rate ? exp.rate : 0;
  renderRateButtons(exp && exp.rate ? exp.rate : 0);
  $('#expense-delete').style.display = exp ? 'inline-flex' : 'none';
  openModal('#expense-modal');
}

function renderRateButtons(sel) {
  document.querySelectorAll('.rate-btn').forEach((b) => {
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

function saveExpense(ev) {
  ev.preventDefault();
  const id = $('#expense-id').value;
  const exp = {
    id: id || uid(),
    createdAt: id ? '' : new Date().toISOString(),
    name: $('#expense-name').value.trim(),
    amount: parseFloat($('#expense-amount').value),
    category: $('#expense-category').value,
    date: $('#expense-date').value,
    notes: $('#expense-notes').value.trim(),
    repeat: $('#expense-repeat').checked,
    rate: Number($('#expense-rate-val').value) || 0
  };
  if (!exp.name) { sfx.error(); toast('Enter a name', '⚠️'); return; }
  if (!(exp.amount > 0)) { sfx.error(); toast('Amount must be more than 0', '⚠️'); return; }
  const isNew = !id;
  if (id) {
    const prev = state.expenses.find((e) => e.id === id);
    exp.createdAt = prev ? prev.createdAt : new Date().toISOString();
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
  closeModal('#budget-modal');
}

function openIncomeModal() {
  $('#income-modal-month').textContent = monthLabel(dashMonth);
  $('#income-name').value = '';
  $('#income-amount').value = '';
  $('#income-date').value = dashMonth === monthKey(iso(today())) ? iso(today()) : dashMonth + '-01';
  $('#income-repeat').checked = false;
  $('#income-list').innerHTML = renderIncomeList();
  openModal('#income-modal');
}

function renderIncomeList() {
  const list = incomesInMonth(dashMonth);
  if (list.length === 0) {
    return '<div class="empty-state" style="padding:18px 6px"><span class="big">💵</span>No income added this month yet.</div>';
  }
  return list.map((i) => `
    <div class="income-item">
      <span class="income-ico">${esc(i.emoji || '💰')}</span>
      <span class="income-main">
        <b>${esc(i.name)}</b>
        <small>${fmtDate(i.date)}${i.repeat ? ' · 🔁 repeats monthly' : ''}</small>
      </span>
      <span class="income-amt">+${fmt(i.amount)}</span>
      <button class="mini-btn danger" data-act="del-income" data-id="${i.id}" aria-label="Delete income">🗑</button>
    </div>`).join('');
}

function addIncome(ev) {
  ev.preventDefault();
  const name = $('#income-name').value.trim();
  const amount = parseFloat($('#income-amount').value);
  const date = $('#income-date').value || dashMonth + '-01';
  const repeat = $('#income-repeat').checked;
  if (!name) { sfx.error(); toast('Enter a source name', '⚠️'); return; }
  if (!(amount > 0)) { sfx.error(); toast('Amount must be more than 0', '⚠️'); return; }
  const emojiVisible = repeat ? '🔁' : '💰';
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
  toast(name + ' added to income', emojiVisible);
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
  renderAll();
}

function backupData() {
  const payload = {
    app: 'spendsync',
    version: 3,
    exportedAt: new Date().toISOString(),
    data: state
  };
  const filename = 'spendsync-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  download(filename, JSON.stringify(payload, null, 2), 'application/json');
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

function savePot(ev) {
  ev.preventDefault();
  const id = $('#pot-id').value;
  const prev = id ? state.pots.find((p) => p.id === id) : null;
  const pot = {
    id: id || uid(),
    createdAt: new Date().toISOString(),
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
}

function reload() {
  saveData();
  renderAll();
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
  const incs = incomesInMonth(summaryMonth).sort((a, b) => (a.date < b.date ? -1 : 1));
  const rows = [
    ['Type', 'Date', 'Category', 'Name', 'Amount (RM)', 'Rating', 'Repeats', 'Notes'],
    ...incs.map((i) => ['income', i.date, '—', i.name, i.amount.toFixed(2), '', i.repeat ? 'yes' : '', '']),
    ...monthExp.map((e) => ['expense', e.date, e.category, e.name, e.amount.toFixed(2), e.rate ? e.rate : '', e.repeat ? 'yes' : '', e.notes || ''])
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
  const income = incomeForMonth(summaryMonth);
  const net = income - spent;
  const byCat = {};
  monthExp.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const incs = incomesInMonth(summaryMonth);
  const rated = monthExp.filter((e) => e.rate >= 1 && e.rate <= 5);
  const score = rated.length ? Math.round((rated.reduce((a, e) => a + e.rate, 0) / rated.length) * 10) / 10 : 0;
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
  lines.push(`Income:       ${income > 0 ? fmt(income) : 'Not set'}`);
  lines.push(`Net savings:  ${income > 0 ? fmt(net) : '—'}`);
  lines.push(`Total spent:  ${fmt(spent)}`);
  lines.push(`Remaining:    ${budget > 0 ? fmt(budget - spent) : '—'}${budget > 0 && budget - spent < 0 ? ' (OVER BUDGET!)' : ''}`);
  lines.push(`Transactions: ${monthExp.length}`);
  lines.push(`Daily avg:    ${fmt(spent / daysElapsed)}`);
  lines.push(`Value score:  ${rated.length ? score.toFixed(1) + '/5 (' + rated.length + ' rated)' : '—'}`);
  lines.push('');
  if (incs.length) {
    lines.push('--- INCOME SOURCES ---');
    incs.forEach((i) => lines.push(`  ${i.name.padEnd(18)} ${fmt(i.amount)}${i.repeat ? '  (repeats)' : ''}`));
    lines.push('');
  }
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
      lines.push(`  [${e.date}] ${e.name} — ${fmt(e.amount)} (${e.category})${e.rate ? ' ' + RATE_EMOJIS[e.rate] : ''}${e.repeat ? ' 🔁' : ''}${e.notes ? ' — ' + e.notes : ''}`);
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
  if (name === 'cat') renderCatTab();
}

function renderCatTab() {
  const info = petXpInfo();
  const key = dashMonth;
  const mood = petMood(key);
  $('#cat-svg-big').innerHTML = catSVG(info.lv, mood);
  $('#cat-name').textContent = state.petName || 'Duit';
  $('#cat-level').textContent = 'LV ' + (info.lv + 1) + ' · ' + info.tag;
  $('#cat-line').textContent = info.line;
  $('#cat-xp').textContent = info.xp + ' XP' + (info.next ? ' · ' + (info.next.xp - info.xp) + ' to ' + info.next.tag : ' · MAX LEVEL');
  $('#cat-xp-fill-big').style.width = info.pct + '%';
  $('#cat-meta').textContent = petMoodText(mood);
  const shelf = $('#ach-shelf');
  const have = new Set(state.awards);
  shelf.innerHTML = ACHIEVEMENTS.map((a) => {
    const got = have.has(a.id);
    return `<div class="ach ${got ? 'got' : 'locked'}">
      <span class="ach-ico">${got ? a.icon : '🔒'}</span>
      <span class="ach-txt"><b>${esc(a.title)}</b><small>${esc(a.desc)}</small></span>
      ${got ? '<span class="ach-check">✓</span>' : ''}
    </div>`;
  }).join('');
  const count = state.awards.length;
  $('#ach-count').textContent = count + ' / ' + ACHIEVEMENTS.length;
}

function petMoodText(mood) {
  return {
    grumpy: '🙀 Grumpy — overspent this month!',
    worried: '😿 Worried — getting close to your budget.',
    happy: '😻 Happy — money is flowing nicely!'
  }[mood];
}

function setupEvents() {
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  function navMonth(delta) {
    dashMonth = shiftMonth(dashMonth, delta);
    const moved = rollRecurring();
    if (moved) { saveData(); toast(moved + ' recurring item(s) rolled into ' + monthLabel(dashMonth), '🔁'); }
    renderBudget(); renderPeriod(); renderCharts(); renderCategories(); renderExpenses(); renderPetWidget();
    sfx.click();
  }
  $('#prev-month').addEventListener('click', () => navMonth(-1));
  $('#next-month').addEventListener('click', () => navMonth(1));
  $('#sum-prev').addEventListener('click', () => { summaryMonth = shiftMonth(summaryMonth, -1); year = Number(summaryMonth.slice(0, 4)); renderSummary(); sfx.click(); });
  $('#sum-next').addEventListener('click', () => { summaryMonth = shiftMonth(summaryMonth, 1); year = Number(summaryMonth.slice(0, 4)); renderSummary(); sfx.click(); });
  $('#year-prev').addEventListener('click', () => { year--; const [y, m] = summaryMonth.split('-'); summaryMonth = year + '-' + m; renderSummary(); sfx.click(); });
  $('#year-next').addEventListener('click', () => { year++; const [y, m] = summaryMonth.split('-'); summaryMonth = year + '-' + m; renderSummary(); sfx.click(); });

  document.querySelectorAll('.pill').forEach((p) => {
    p.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach((x) => x.classList.toggle('active', x === p));
      period = p.dataset.period;
      renderPeriod();
      sfx.click();
    });
  });

  $('#edit-budget').addEventListener('click', openBudgetModal);
  $('#edit-income').addEventListener('click', openIncomeModal);
  $('#add-expense-btn').addEventListener('click', () => openExpenseModal(null));
  $('#fab').addEventListener('click', () => openExpenseModal(null));
  $('#add-pot-btn').addEventListener('click', () => openPotModal(null));

  $('#expense-form').addEventListener('submit', saveExpense);
  $('#budget-form').addEventListener('submit', saveBudget);
  $('#income-form').addEventListener('submit', addIncome);
  $('#pot-form').addEventListener('submit', savePot);
  $('#fund-form').addEventListener('submit', fundPot);

  document.querySelectorAll('.rate-btn').forEach((b) => {
    b.addEventListener('click', () => pickRate(Number(b.dataset.rate)));
  });
  $('#rate-clear').addEventListener('click', () => pickRate(0));
  $('#income-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act="del-income"]');
    if (!btn) return;
    deleteIncome(btn.dataset.id);
    $('#income-list').innerHTML = renderIncomeList();
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

  document.querySelectorAll('.quick-chips .chip-btn').forEach((c) => {
    c.addEventListener('click', () => {
      const input = c.closest('.modal-card').querySelector('input[type="number"]');
      if (input) input.value = c.dataset.amount;
      sfx.click();
    });
  });

  $('#sound-btn').addEventListener('click', () => {
    soundOn = !soundOn;
    localStorage.setItem('ss_sound', soundOn ? 'on' : 'off');
    updateSoundBtn();
    if (soundOn) sfx.success();
  });

  $('#pet-svg').addEventListener('click', () => {
    petReaction($('#pet-svg'));
    addPetXp(2);
    renderPetWidget();
    sfx.coin();
    toast('Duit purrs (+2 XP)', '🐱');
  });

  $('#rename-pet-btn').addEventListener('click', () => {
    const name = prompt('Name your money cat:', state.petName || 'Duit');
    if (name && name.trim()) {
      state.petName = name.trim().slice(0, 24);
      saveData();
      renderCatTab();
      sfx.success();
    }
  });

  $('#cat-svg-big').addEventListener('click', () => {
    petReaction($('#cat-svg-big'));
    addPetXp(2);
    renderCatTab();
    sfx.coin();
    toast('Duit purrs (+2 XP)', '🐱');
  });

  $('#download-csv').addEventListener('click', downloadCSV);
  $('#download-report').addEventListener('click', downloadReport);
  $('#backup-btn').addEventListener('click', backupData);
  $('#restore-btn').addEventListener('click', () => {
    if (confirm('Restore replaces ALL current data on this device. Continue?')) $('#restore-file').click();
  });
  $('#restore-file').addEventListener('change', restoreData);

  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn, .tab, .pill, .icon-btn, .chip-btn, .mini-btn')) sfx.click();
  });

  $('#expense-category').innerHTML = CATEGORIES.map((c) => `<option value="${c.name}">${c.emoji} ${c.name}</option>`).join('');
  setupSwipes();
}

function setupSwipes() {
  if (!('ontouchstart' in window)) return;

  const swipe = { sx: 0, sy: 0, item: null };

  document.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    swipe.sx = t.clientX;
    swipe.sy = t.clientY;
    swipe.item = e.target.closest('.expense-item') || null;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!swipe.item) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipe.sx;
    const dy = t.clientY - swipe.sy;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - swipe.sx;
    const dy = t.clientY - swipe.sy;
    const item = swipe.item;
    swipe.item = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.4) return;

    if (item) {
      if (dx < 0) {
        const delBtn = item.querySelector('[data-act="del"]');
        if (delBtn) {
          const exp = state.expenses.find((x) => x.id === delBtn.dataset.id);
          if (exp) deleteExpense(exp);
        }
      }
      return;
    }

    if (view === 'dashboard') {
      dashMonth = shiftMonth(dashMonth, dx < 0 ? 1 : -1);
      renderBudget(); renderPeriod(); renderCharts(); renderCategories(); renderExpenses();
    } else if (view === 'summary') {
      summaryMonth = shiftMonth(summaryMonth, dx < 0 ? 1 : -1);
      year = Number(summaryMonth.slice(0, 4));
      renderSummary();
    }
    sfx.click();
  }, { passive: true });
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
boot();