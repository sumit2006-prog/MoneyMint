import { Router } from 'express';
import PDFDocument from 'pdfkit';
import authenticate from '../middleware/auth.js';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import { fromPaise, mongoPaiseSum, sumMoney } from '../lib/money.js';
import { parseDateBoundary } from '../middleware/validate.js';
import { createReportWorkbook } from '../lib/spreadsheet.js';
import { csvCell } from '../lib/csv.js';
const router = Router();
router.use(authenticate);
router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const start = req.query.start ? parseDateBoundary(String(req.query.start)) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = req.query.end ? parseDateBoundary(String(req.query.end), true) : now;
    if (!start || !end || start > end) return res.status(400).json({ message: 'Choose a valid report date range.' });
    const match = { userId: req.user._id, date: { $gte: start, $lte: end } };
    if (['income', 'expense'].includes(req.query.type)) match.type = req.query.type;
    const transactions = await Transaction.find(match).sort({ date: -1 }).lean();
    const totals = { income: sumMoney(transactions.filter((t) => t.type === 'income').map((t) => t.amount)), expense: sumMoney(transactions.filter((t) => t.type === 'expense').map((t) => t.amount)) };
    const categoryTotals = match.type === 'income' ? [] : (await Transaction.aggregate([{ $match: { ...match, type: 'expense' } }, { $group: { _id: '$category', amountPaise: mongoPaiseSum() } }, { $sort: { amountPaise: -1 } }])).map((item) => ({ ...item, amount: fromPaise(item.amountPaise) }));
    const budgets = await Budget.find({ userId: req.user._id }).lean();
    const budgetUsage = budgets.map((budget) => {
      const spent = budget.type === 'category' ? categoryTotals.find((item) => item._id === budget.category)?.amount || 0 : totals.expense;
      return { type: budget.type, category: budget.category, limit: budget.limit, spent, percent: budget.limit ? Math.round(spent / budget.limit * 100) : 0 };
    });
    const format = String(req.query.format || 'json');
    if (format === 'xlsx') {
      const workbook = createReportWorkbook(transactions, { totals, categories: categoryTotals.map((item) => ({ category: item._id, amount: item.amount })), budgets: budgetUsage });
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="moneymint-report.xlsx"');
      return res.send(Buffer.from(buffer));
    }
    if (format === 'csv') {
      const rows = [['Date', 'Description', 'Category', 'Type', 'Payment method', 'Amount', 'Merchant'], ...transactions.map((t) => [new Date(t.date).toLocaleDateString('en-IN'), t.description, t.category, t.type, t.paymentMethod, t.amount, t.merchant])];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="moneymint-report.csv"');
      return res.send(`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`);
    }
    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 44, size: 'A4' }); const buffers = [];
      doc.on('data', (buf) => buffers.push(buf));
      doc.on('end', () => { res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'attachment; filename="moneymint-report.pdf"'); res.send(Buffer.concat(buffers)); });
      doc.fillColor('#07563e').fontSize(24).font('Helvetica-Bold').text('MoneyMint', { continued: true }).fillColor('#66746e').fontSize(10).font('Helvetica').text('  •  TRACK · PLAN · SAVE · GROW');
      doc.moveDown(0.4).fillColor('#192922').fontSize(17).font('Helvetica-Bold').text('Personal finance report');
      doc.font('Helvetica').fontSize(10).fillColor('#66746e').text(`${start.toLocaleDateString('en-IN')} – ${end.toLocaleDateString('en-IN')}`); doc.moveDown();
      doc.fillColor('#07563e').fontSize(11).font('Helvetica-Bold').text(`Income:  INR ${totals.income.toLocaleString('en-IN')}     Expenses:  INR ${totals.expense.toLocaleString('en-IN')}     Savings:  INR ${fromPaise(Math.round((totals.income - totals.expense) * 100)).toLocaleString('en-IN')}`); doc.moveDown();
      doc.fillColor('#192922').fontSize(10).font('Helvetica-Bold').text('Expense categories'); doc.font('Helvetica').fontSize(9).fillColor('#52635a');
      if (categoryTotals.length) categoryTotals.slice(0, 8).forEach((item) => doc.text(`${item._id}: INR ${item.amount.toLocaleString('en-IN')}`)); else doc.text('No expenses in this period.'); doc.moveDown(0.5);
      if (budgetUsage.length) { doc.font('Helvetica-Bold').fillColor('#192922').text('Budget usage'); doc.font('Helvetica').fontSize(9).fillColor('#52635a'); budgetUsage.forEach((item) => doc.text(`${item.type === 'category' ? item.category : item.type}: INR ${item.spent.toLocaleString('en-IN')} / INR ${item.limit.toLocaleString('en-IN')} (${item.percent}%)`)); doc.moveDown(0.5); }
      doc.fillColor('#192922').fontSize(9).text('Date          Description                    Category                  Type              Amount', { continued: false }); doc.moveTo(44, doc.y + 4).lineTo(550, doc.y + 4).strokeColor('#dce8e2').stroke(); doc.moveDown(0.7);
      transactions.slice(0, 70).forEach((t) => { doc.fillColor('#283b32').text(`${new Date(t.date).toLocaleDateString('en-IN').padEnd(13)} ${(t.description || t.merchant || 'Transaction').slice(0, 25).padEnd(28)} ${t.category.slice(0, 20).padEnd(22)} ${t.type.padEnd(15)} INR ${t.amount.toLocaleString('en-IN')}`, { lineBreak: false }); doc.moveDown(0.45); });
      doc.end(); return;
    }
    res.json({ transactions, totals, categories: categoryTotals.map((item) => ({ category: item._id, amount: item.amount })), budgets: budgetUsage, range: { start, end } });
  } catch (err) { next(err); }
});
export default router;
