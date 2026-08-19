const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');

app.use(express.json({ limit: '2mb' }));

const DEFAULT_DATA = { budgets: {}, expenses: [], pots: [] };

let db = null;
let writeQueue = Promise.resolve();

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return {
        budgets: raw.budgets || {},
        expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
        pots: Array.isArray(raw.pots) ? raw.pots : []
      };
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

app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

app.get('/api/state', (req, res) => {
  res.json(db);
});

app.post('/api/budget', (req, res) => {
  const month = String(req.body.month || '');
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'Invalid month' });
  const value = Math.max(0, parseFloat(req.body.amount) || 0);
  const next = { ...db, budgets: { ...db.budgets, [month]: value } };
  commit(next).then(() => res.json({ ok: true, budgets: next.budgets }));
});

app.post('/api/expenses', (req, res) => {
  const body = req.body || {};
  if (!validDate(body.date)) return res.status(400).json({ error: 'Invalid date' });
  const expense = sanitizeExpense({ id: uid(), createdAt: new Date().toISOString(), ...body });
  if (!expense.name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (expense.amount <= 0) return res.status(400).json({ error: 'Amount must be more than 0' });
  const next = { ...db, expenses: [expense, ...db.expenses] };
  commit(next).then(() => res.json({ ok: true, expense }));
});

app.put('/api/expenses/:id', (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const existing = db.expenses.find((e) => e.id === id);
  if (!existing) return res.status(404).json({ error: 'Expense not found' });
  if (body.date !== undefined && !validDate(body.date)) return res.status(400).json({ error: 'Invalid date' });
  const merged = sanitizeExpense({ ...existing, ...body, id, createdAt: existing.createdAt });
  if (!merged.name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (merged.amount <= 0) return res.status(400).json({ error: 'Amount must be more than 0' });
  const next = {
    ...db,
    expenses: db.expenses.map((e) => (e.id === id ? merged : e))
  };
  commit(next).then(() => res.json({ ok: true, expense: merged }));
});

app.delete('/api/expenses/:id', (req, res) => {
  const id = req.params.id;
  if (!db.expenses.some((e) => e.id === id)) return res.status(404).json({ error: 'Expense not found' });
  const next = { ...db, expenses: db.expenses.filter((e) => e.id !== id) };
  commit(next).then(() => res.json({ ok: true }));
});

app.post('/api/pots', (req, res) => {
  const body = req.body || {};
  const pot = sanitizePot({ id: uid(), createdAt: new Date().toISOString(), ...body });
  if (!pot.name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (pot.target <= 0) return res.status(400).json({ error: 'Target must be more than 0' });
  const next = { ...db, pots: [pot, ...db.pots] };
  commit(next).then(() => res.json({ ok: true, pot }));
});

app.put('/api/pots/:id', (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const existing = db.pots.find((p) => p.id === id);
  if (!existing) return res.status(404).json({ error: 'Pot not found' });
  const merged = sanitizePot({ ...existing, ...body, id, createdAt: existing.createdAt });
  if (!merged.name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (merged.target <= 0) return res.status(400).json({ error: 'Target must be more than 0' });
  const next = { ...db, pots: db.pots.map((p) => (p.id === id ? merged : p)) };
  commit(next).then(() => res.json({ ok: true, pot: merged }));
});

app.post('/api/pots/:id/fund', (req, res) => {
  const id = req.params.id;
  const pot = db.pots.find((p) => p.id === id);
  if (!pot) return res.status(404).json({ error: 'Pot not found' });
  const amount = Math.max(0, parseFloat((req.body || {}).amount) || 0);
  if (amount <= 0) return res.status(400).json({ error: 'Amount must be more than 0' });
  const next = {
    ...db,
    pots: db.pots.map((p) => (p.id === id ? { ...p, saved: Math.max(0, p.saved + amount) } : p))
  };
  commit(next).then(() => res.json({ ok: true, pot: next.pots.find((p) => p.id === id) }));
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`SpendSync running on http://localhost:${PORT}`);
});