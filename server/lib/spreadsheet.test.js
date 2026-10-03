import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createReportWorkbook, readXlsxRows } from './spreadsheet.js';

test('reads reviewed XLSX rows without evaluating formulas', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Statement');
  sheet.addRow(['Date', 'Description', 'Amount']);
  sheet.addRow([new Date(2026, 9, 2, 12), 'Cafe', 150.5]);
  const rows = await readXlsxRows(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Description, 'Cafe');
  assert.equal(rows[0].Amount, 150.5);
  assert.ok(rows[0].Date instanceof Date);
});

test('creates transaction and summary tabs in Excel reports', async () => {
  const workbook = createReportWorkbook([{ date: '2026-10-02T06:30:00.000Z', description: 'Food', merchant: '', category: 'Food', type: 'expense', paymentMethod: 'UPI', amount: 150.5 }], {
    totals: { income: 1000, expense: 150.5 }, categories: [{ category: 'Food', amount: 150.5 }], budgets: [],
  });
  const output = new ExcelJS.Workbook();
  await output.xlsx.load(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.deepEqual(output.worksheets.map((sheet) => sheet.name), ['Transactions', 'Summary']);
  assert.equal(output.getWorksheet('Transactions').getCell('F2').value, 150.5);
  assert.equal(output.getWorksheet('Summary').getCell('A4').value, 'Savings');
});
