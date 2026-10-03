import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDateBoundary, parseTransactionDate, validateTransaction } from './validate.js';

const good = { amount: 0.01, type: 'expense', category: 'Food', date: '2026-10-02T06:30:00.000Z' };

test('validates transaction amounts, types, categories, and required dates', () => {
  assert.equal(validateTransaction(good), null);
  assert.match(validateTransaction({ ...good, amount: 0 }), /amount greater than zero/);
  assert.match(validateTransaction({ ...good, amount: -1 }), /amount greater than zero/);
  assert.match(validateTransaction({ ...good, amount: 1.001 }), /two decimal places/);
  assert.match(validateTransaction({ ...good, amount: 1_000_000_000.01 }), /amount greater than zero/);
  assert.match(validateTransaction({ ...good, type: 'other' }), /income or expense/);
  assert.match(validateTransaction({ ...good, category: '' }), /category/);
  assert.match(validateTransaction({ ...good, date: '' }), /valid transaction date/);
});

test('rejects impossible calendar dates and uses inclusive local-day boundaries', () => {
  assert.equal(parseTransactionDate('2026-02-30'), null);
  assert.ok(parseTransactionDate('2024-02-29'));
  assert.equal(parseTransactionDate('02/10/2026'), null);
  const start = parseDateBoundary('2026-10-02');
  const end = parseDateBoundary('2026-10-02', true);
  assert.equal(start.getHours(), 0);
  assert.equal(end.getHours(), 23);
  assert.equal(end.getMilliseconds(), 999);
});
