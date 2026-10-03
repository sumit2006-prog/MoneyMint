import test from 'node:test';
import assert from 'node:assert/strict';
import { transactionSignatures } from './transactionChecks.js';

test('duplicate signatures combine day, paise, type, description, merchant, and identifiers', () => {
  const item = { date: '2026-10-02T06:30:00.000Z', amount: 150.5, type: 'expense', description: 'Dinner at Cafe', merchant: 'Cafe' };
  const signatures = transactionSignatures(item);
  assert.ok(signatures.includes('2026-10-02|15050|expense|dinner at cafe'));
  assert.ok(signatures.includes('2026-10-02|15050|expense|cafe'));
  assert.ok(transactionSignatures({ ...item, transactionId: 'UTR-123' }).includes('id|utr-123'));
  assert.deepEqual(transactionSignatures({ ...item, amount: 1.001 }), []);
});
