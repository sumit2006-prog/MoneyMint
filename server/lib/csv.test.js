import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell } from './csv.js';

test('quotes CSV values and neutralizes spreadsheet formula prefixes', () => {
  assert.equal(csvCell('normal, text'), '"normal, text"');
  assert.equal(csvCell('say "hello"'), '"say ""hello"""');
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('  @SUM(A1:A2)'), '"\'  @SUM(A1:A2)"');
  assert.equal(csvCell(125.5), '"125.5"');
});
