import ExcelJS from 'exceljs';

const cellValue = (value) => {
  if (value && typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
    if (Object.hasOwn(value, 'result')) return value.result;
    if (Object.hasOwn(value, 'text')) return value.text;
  }
  return value ?? '';
};

export async function readXlsxRows(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet || !sheet.rowCount) return [];
  const headers = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => { headers[column - 1] = String(cellValue(cell.value) || '').trim(); });
  if (!headers.some(Boolean)) return [];
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const item = {};
    headers.forEach((header, index) => { if (header) item[header] = cellValue(row.getCell(index + 1).value); });
    if (Object.values(item).some((value) => String(value ?? '').trim())) rows.push(item);
  });
  return rows;
}

export function createReportWorkbook(transactions, report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MoneyMint';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Transactions', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Description', key: 'description', width: 34 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Payment method', key: 'paymentMethod', width: 20 },
    { header: 'Amount', key: 'amount', width: 16 },
    { header: 'Merchant', key: 'merchant', width: 24 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF087A57' } };
  sheet.addRows(transactions.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-IN'),
    description: item.description || item.merchant || item.category,
    category: item.category,
    type: item.type,
    paymentMethod: item.paymentMethod,
    amount: item.amount,
    merchant: item.merchant,
  })));
  const summary = workbook.addWorksheet('Summary');
  summary.addRows([
    ['MoneyMint report'],
    ['Income', report.totals.income],
    ['Expenses', report.totals.expense],
    ['Savings', report.totals.income - report.totals.expense],
    ...report.categories.map((item) => [`Expense · ${item.category}`, item.amount]),
    ...report.budgets.map((item) => [`Budget · ${item.category || item.type}`, `${item.spent} / ${item.limit} (${item.percent}%)`]),
  ]);
  summary.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF087A57' } };
  summary.getColumn(1).width = 34;
  summary.getColumn(2).width = 24;
  return workbook;
}
