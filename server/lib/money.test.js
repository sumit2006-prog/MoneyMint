import test from 'node:test';
import assert from 'node:assert/strict';
import { fromPaise, mongoPaiseSum, normalizeMoney, sumMoney, toPaise } from './money.js';

test('converts common rupee amounts to exact paise', () => {
  for (const [rupees, paise] of [[0, 0], [1, 100], [100, 10000], [1000, 100000], [10000, 1000000], [100000, 10000000], [150.5, 15050]]) {
    assert.equal(toPaise(rupees), paise);
    assert.equal(fromPaise(paise), rupees);
  }
});

test('rejects invalid and over-precision input while preserving negative totals', () => {
  for (const invalid of ['', null, undefined, 'nope', -1, 1.001, 1_000_000_000.01]) assert.equal(normalizeMoney(invalid), null);
  assert.equal(normalizeMoney('1.2300'), 1.23);
  assert.equal(normalizeMoney('999999999.99'), 999999999.99);
  assert.equal(normalizeMoney('1000000000'), 1000000000);
  assert.equal(normalizeMoney('1.005'), null);
  assert.equal(fromPaise(toPaise(1) - toPaise(100)), -99);
});

test('sums decimal values in integer paise', () => {
  assert.equal(sumMoney([0.1, 0.2, 0.7, 999.99]), 1000.99);
  assert.deepEqual(mongoPaiseSum(), { $sum: { $round: [{ $multiply: ['$amount', 100] }, 0] } });
});
