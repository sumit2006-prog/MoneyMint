import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSpendingPercent, spendingGaugeAngle, spendingGaugeStatus } from './spendingGauge.js';

test('maps real monthly budget usage into the requested spending states', () => {
  for (const value of [20, 60, 70]) assert.equal(spendingGaugeStatus(value), 'LOW');
  for (const value of [75, 85]) assert.equal(spendingGaugeStatus(value), 'MEDIUM');
  for (const value of [90, 95, 100]) assert.equal(spendingGaugeStatus(value), 'HIGH');
  for (const value of [105, 120]) assert.equal(spendingGaugeStatus(value), 'OVER LIMIT');
});

test('moves the needle across all four sections and clamps beyond the dial', () => {
  assert.equal(spendingGaugeAngle(0), -90);
  assert.equal(spendingGaugeAngle(70), -45);
  assert.equal(spendingGaugeAngle(90), 0);
  assert.equal(spendingGaugeAngle(100), 45);
  assert.equal(spendingGaugeAngle(120), 90);
  assert.equal(spendingGaugeAngle(150), 90);
});

test('shows up to one decimal place without redundant zeroes', () => {
  assert.equal(formatSpendingPercent(104.285), '104.3');
  assert.equal(formatSpendingPercent(75), '75');
});
