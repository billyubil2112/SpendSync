const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');

app.use(express.json({ limit: '2mb' }));

const EMPTY_USER = { budgets: {}, expenses: [], pots: [] };
const DEFAULT_DATA = { users: {}, data: {}, sessions: {}, legacy: null };

let db = null;
let writeQueue = Promise.resolve();

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (!raw.users) {
        // old single-user format -> keep for migration into the first account
        return {
          ...JSON.parse(JSON.stringify(DEFAULT_DATA)),
          legacy: {
            budgets: raw.budgets || {},
            expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
            pots: Array.isArray(raw.pots) ? raw.pots : []
          }
        };
      }
      return { ...JSON.parse(JSON.stringify(DEFAULT_DATA)), ...raw };
    }
  } catch (err) {
    console.error('Failed to read data file, starting fresh:', err.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function saveData(data) {
  writeQueue = writeQueue.then(() => {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  }).catch((err) => {
    console.error('Failed to save data:', err.message);
  });
  return writeQueue;
}

db = loadData();

function commit(next) {
  db = next;
  return saveData(next);
}

function uid() {
  return crypto.randomBytes(6).toString('hex');
}

function token() {
  return crypto.randomBytes(24).toString('hex');
}

function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}

function hashPin(pin, salt) {
  return crypto.createHash('sha256').update(salt + ':' + pin).digest('hex');
}

function makeUser(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: hashPin(pin, salt), createdAt: Date.now() };
}

function userData(email) {
  if (!db.data[email]) db.data[email] = { budgets: {}, expenses: [], pots: [] };
  return db.data[email];
}

function sanitizeExpense(e) {
  return {
    id: e.id,
    name: String(e.name || '').slice(0, 120),
    amount: Math.max(0, parseFloat(e.amount) || 0),
    category: String(e.category || 'Others').slice(0, 40),
    notes: String(e.notes || '').slice(0, 500),
    date: String(e.date || '').slice(0, 10),
    createdAt: e.createdAt || new Date().toISOString()
  };
}

function sanitizePot(p) {
  return {
    id: p.id,
    name: String(p.name || '').slice(0, 60),
    target: Math.max(0, parseFloat(p.target) || 0),
    saved: Math.max(0, parseFloat(p.saved) || 0),
    color: String(p.color || '').slice(0, 20),
    createdAt: p.createdAt || new Date().toISOString()
  };
}

function validDate(d) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + 'T00:00:00').getTime());
}

/* ---------- Auth middleware ---------- */

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  const sess = t && db.sessions[t];
  if (!sess) return res.status(401).json({ error: 'Not logged in' });
  req.user = sess.email;
  req.token = t;
  next();
}

/* ---------- Login rate limiting ---------- */

const loginAttempts = {};

function rateOk(email) {
  const a = loginAttempts[email];
  if (!a) return true;
  if (a.until > Date.now()) return false;
  delete loginAttempts[email];
  return true;
}

function rateFail(email) {
  const a = loginAttempts[email] || { count: 0 };
  a.count += 1;
  if (a.count >= 5) {
    a.until = Date.now() + 60000;
    a.count = 0;
  }
  loginAttempts[email] = a;
}

/* ---------- Health ---------- */

app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

/* ---------- Auth endpoints ---------- */

app.post('/api/login', (req, res) => {
  const email = normEmail((req.body || {}).email);
  const pin = String((req.body || {}).pin || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (!/^\d{6}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 6 digits' });
  if (!rateOk(email)) return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });

  let user = db.users[email];
  let newUser = false;

  if (!user) {
    user = makeUser(pin);
    db = { ...db, users: { ...db.users, [email]: user } };
    newUser = true;
    if (db.legacy) {
      db = { ...db, data: { ...db.data, [email]: db.legacy }, legacy: null };
    }
  } else {
    if (hashPin(pin, user.salt) !== user.hash) {
      rateFail(email);
      return res.status(401).json({ error: 'Wrong PIN. Try again.' });
    }
  }

  const t = token();
  db = { ...db, sessions: { ...db.sessions, [t]: { email, createdAt: Date.now() } } };
  commit(db).then(() => res.json({ ok: true, token: t, email, newUser }));
});

app.post('/api/logout', (req, res) => {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (t && db.sessions[t]) {
    const next = { ...db, sessions: { ...db.sessions } };
    delete next.sessions[t];
    commit(next).then(() => res.json({ ok: true }));
  } else {
    res.json({ ok: true });
  }
});

app.get('/api/session', auth, (req, res) => res.json({ ok: true, email: req.user }));

/* ---------- State ---------- */

app.get('/api/state', auth, (req, res) => {
  res.json(userData(req.user));
});

/* ---------- Budget ---------- */

app.post('/api/budget', auth, (req, res) => {
  const month = String(req.body.month || '');
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'Invalid month' });
  const value = Math.max(0, parseFloat(req.body.amount) || 0);
  const ud = userData(req.user);
  const next = {
    ...db,
    data: { ...db.data, [req.user]: { ...ud, budgets: { ...ud.budgets, [month]: value } } }
  };
  commit(next).then(() => res.json({ ok: true, budgets: next.data[req.user].budgets }));
});

/* ---------- Expenses ---------- */

app.post('/api/expenses', auth, (req, res) => {
  const body = req.body || {};
  if (!validDate(body.date)) return res.status(400).json({ error: 'Invalid date' });
  const expense = sanitizeExpense({ id: uid(), createdAt: new Date().toISOString(), ...body });
  if (!expense.name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (expense.amount <= 0) return res.status(400).json({ error: 'Amount must be more than 0' });
  const ud = userData(req.user);
  const next = {
    ...db,
    data: { ...db.data, [req.user]: { ...ud, expenses: [expense, ...ud.expenses] } }
  };
  commit(next).then(() => res.json({ ok: true, expense }));
});

app.put('/api/expenses/:id', auth, (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const ud = userData(req.user);
  const existing = ud.expenses.find((e) => e.id === id);
  if (!existing) return res.status(404).json({ error: 'Expense not found' });
  if (body.date !== undefined && !validDate(body.date)) return res.status(400).json({ error: 'Invalid date' });
  const merged = sanitizeExpense({ ...existing, ...body, id, createdAt: existing.createdAt });
  if (!merged.name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (merged.amount <= 0) return res.status(400).json({ error: 'Amount must be more than 0' });
  const next = {
    ...db,
    data: { ...db.data, [req.user]: { ...ud, expenses: ud.expenses.map((e) => (e.id === id ? merged : e)) } }
  };
  commit(next).then(() => res.json({ ok: true, expense: merged }));
});

app.delete('/api/expenses/:id', auth, (req, res) => {
  const id = req.params.id;
  const ud = userData(req.user);
  if (!ud.expenses.some((e) => e.id === id)) return res.status(404).json({ error: 'Expense not found' });
  const next = {
    ...db,
    data: { ...db.data, [req.user]: { ...ud, expenses: ud.expenses.filter((e) => e.id !== id) } }
  };
  commit(next).then(() => res.json({ ok: true }));
});

/* ---------- Saving pots ---------- */

app.post('/api/pots', auth, (req, res) => {
  const body = req.body || {};
  const pot = sanitizePot({ id: uid(), createdAt: new Date().toISOString(), ...body });
  if (!pot.name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (pot.target <= 0) return res.status(400).json({ error: 'Target must be more than 0' });
  const ud = userData(req.user);
  const next = {
    ...db,
    data: { ...db.data, [req.user]: { ...ud, pots: [pot, ...ud.pots] } }
  };
  commit(next).then(() => res.json({ ok: true, pot }));
});

app.put('/api/pots/:id', auth, (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const ud = userData(req.user);
  const existing = ud.pots.find((p) => p.id === id);
  if (!existing) return res.status(404).json({ error: 'Pot not found' });
  const merged = sanitizePot({ ...existing, ...body, id, createdAt: existing.createdAt });
  if (!merged.name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (merged.target <= 0) return res.status(400).json({ error: 'Target must be more than 0' });
  const next = {
    ...db,
    data: { ...db.data, [req.user]: { ...ud, pots: ud.pots.map((p) => (p.id === id ? merged : p)) } }
  };
  commit(next).then(() => res.json({ ok: true, pot: merged }));
});

app.post('/api/pots/:id/fund', auth, (req, res) => {
  const id = req.params.id;
  const ud = userData(req.user);
  const pot = ud.pots.find((p) => p.id === id);
  if (!pot) return res.status(404).json({ error: 'Pot not found' });
  const amount = Math.max(0, parseFloat((req.body || {}).amount) || 0);
  if (amount <= 0) return res.status(400).json({ error: 'Amount must be more than 0' });
  const updated = { ...pot, saved: Math.max(0, pot.saved + amount) };
  const next = {
    ...db,
    data: { ...db.data, [req.user]: { ...ud, pots: ud.pots.map((p) => (p.id === id ? updated : p)) } }
  };
  commit(next).then(() => res.json({ ok: true, pot: updated }));
});

/* ---------- Static ---------- */

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`SpendSync running on http://localhost:${PORT}`);
});