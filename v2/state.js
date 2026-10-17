'use strict';

/* ============================================================
   SpendSync v2 — pure state & data logic (no DOM access here)
   ============================================================ */

/**
 * Transaction shape:
 * {
 *   id: string,
 *   name: string,
 *   category: string,
 *   amount: number,
 *   date: 'YYYY-MM-DD',
 *   budgetImpact: 'daily' | 'capital'
 * }
 *
 * budgetImpact rules:
 *  - 'daily'   : regular living costs, counts against the daily allowance.
 *  - 'capital' : large, lumpy, planned costs (tuition, insurance, bills).
 *                Excluded from daily pace so they don't wreck a RM 15
 *                per-day budget; still counted in monthly cashflow.
 */

/**
 * Tags a category as 'capital' or 'daily' so new transactions
 * inherit the right budget impact automatically.
 */
function categorizeExpense(category) {
  const CAPITAL = new Set(['Education', 'Investments', 'Bills', 'Bills & Utilities', 'Insurance', 'Housing']);
  const DAILY = new Set(['Dining Out', 'Groceries', 'Personal Care', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Travel', 'Others']);
  const key = String(category || 'Others');
  if (CAPITAL.has(key)) return 'capital';
  if (DAILY.has(key)) return 'daily';
  return 'daily';
}

/**
 * Sums only budgetImpact === 'daily' transactions.
 * Returns the remaining allowance (may be negative when overspent).
 */
function calculateDailyPace(transactions, dailyAllowance) {
  const dailySpent = transactions
    .filter((t) => t && t.budgetImpact === 'daily')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  return (Number(dailyAllowance) || 0) - dailySpent;
}

/**
 * Total income minus ALL expenses (daily AND capital).
 * This is the true monthly cashflow picture.
 */
function calculateMonthlyCashflow(transactions, income) {
  const totalSpent = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  return (Number(income) || 0) - totalSpent;
}

/**
 * Group transactions by category.
 * Returns [{ category, transactions, total, count }] sorted by total desc.
 */
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
      total: list.reduce((s, t) => s + (Number(t.amount) || 0), 0),
      count: list.length
    }))
    .sort((a, b) => b.total - a.total);
}

/* ------------------------------------------------------------
   Sample data set for the v2 prototype.
   Real numbers so the pace/cashflow maths is meaningful:
   a RM 1,250 tuition fee (capital) must NOT break the RM 15
   daily budget that the RM 7.50 + RM 8.00 daily spends create.
   ------------------------------------------------------------ */
const SAMPLE_INCOME = 1200;
const DAILY_ALLOWANCE = 15;

const SAMPLE_TRANSACTIONS = [
  { id: 't1', name: 'Tuition fee instalment', category: 'Education', amount: 1250, date: '2026-10-05', budgetImpact: 'capital' },
  { id: 't2', name: 'Nasi lemak & teh tarik', category: 'Dining Out', amount: 7.5, date: '2026-10-16', budgetImpact: 'daily' },
  { id: 't3', name: 'Grab ride to campus', category: 'Transport', amount: 8, date: '2026-10-16', budgetImpact: 'daily' },
  { id: 't4', name: 'Groceries week 1', category: 'Groceries', amount: 63.2, date: '2026-10-06', budgetImpact: 'daily' },
  { id: 't5', name: 'Spotify subscription', category: 'Bills & Utilities', amount: 10.9, date: '2026-10-08', budgetImpact: 'capital' },
  { id: 't6', name: 'Phone bill', category: 'Bills & Utilities', amount: 45, date: '2026-10-09', budgetImpact: 'capital' },
  { id: 't7', name: 'Shampoo & soap', category: 'Personal Care', amount: 23.4, date: '2026-10-12', budgetImpact: 'daily' },
  { id: 't8', name: 'Movie night', category: 'Entertainment', amount: 18, date: '2026-10-14', budgetImpact: 'daily' },
  { id: 't9', name: 'Fixed deposit top-up', category: 'Investments', amount: 100, date: '2026-10-02', budgetImpact: 'capital' }
];
