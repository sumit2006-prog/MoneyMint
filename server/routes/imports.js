import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import pdfParse from 'pdf-parse';
import crypto from 'node:crypto';
import authenticate from '../middleware/auth.js';
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import ImportedStatement from '../models/ImportedStatement.js';
import { validateTransaction } from '../middleware/validate.js';
import { notifyBudgetCrossings } from '../services/notifications.js';
import { normalizeMoney, sumMoney } from '../lib/money.js';
import { transactionSignatures } from '../services/transactionChecks.js';
import { readXlsxRows } from '../lib/spreadsheet.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => {
  if (/\.(csv|xlsx|pdf)$/i.test(file.originalname)) return callback(null, true);
  callback(Object.assign(new Error('Choose a CSV, Excel, or PDF bank statement.'), { status: 400 }));
} });
const text = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const number = (value) => {
  if (typeof value === 'number') return value;
  const clean = text(value).replace(/[₹,$\s]/g, '').replace(/,/g, '');
  if (!clean) return NaN;
  const parsed = Number(clean.replace(/^\((.*)\)$/, '-$1'));
  return Number.isFinite(parsed) ? parsed : NaN;
};
const parseDate = (value) => {
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : value;
  if (typeof value === 'number' && value > 20000 && value < 80000) { const utc = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000); return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), 12); }
  const indian = text(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (indian) { let year = Number(indian[3]); if (year < 100) year += year >= 70 ? 1900 : 2000; const date = new Date(year, Number(indian[2]) - 1, Number(indian[1]), 12); return Number.isNaN(date.valueOf()) || date.getDate() !== Number(indian[1]) || date.getMonth() !== Number(indian[2]) - 1 ? null : date; }
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
};
const keys = {
  date: ['date', 'transaction date', 'value date', 'txn date', 'posting date'],
  amount: ['amount', 'transaction amount', 'txn amount'],
  debit: ['debit', 'withdrawal', 'withdrawal amount', 'dr'],
  credit: ['credit', 'deposit', 'deposit amount', 'cr'],
  description: ['description', 'narration', 'particulars', 'details', 'transaction details', 'merchant'],
  type: ['type', 'transaction type', 'dr/cr', 'credit/debit'],
  id: ['transaction id', 'txn id', 'reference', 'reference number', 'utr']
};
const valueFor = (row, candidates) => {
  const entries = Object.entries(row || {});
  const found = entries.find(([key]) => candidates.includes(String(key).toLowerCase().replace(/[_-]/g, ' ').trim()));
  return found?.[1];
};
const normalizeRow = (row) => {
  const date = parseDate(valueFor(row, keys.date));
  const desc = text(valueFor(row, keys.description) || valueFor(row, ['memo', 'payee', 'remarks', 'narration'])) || 'Bank transaction';
  const debit = number(valueFor(row, keys.debit)); const credit = number(valueFor(row, keys.credit));
  const rawAmount = number(valueFor(row, keys.amount));
  let type = 'expense'; let amount;
  if (Number.isFinite(credit) && credit !== 0 && (!Number.isFinite(debit) || debit === 0)) { type = 'income'; amount = Math.abs(credit); }
  else if (Number.isFinite(debit) && debit !== 0) { type = 'expense'; amount = Math.abs(debit); }
  else if (Number.isFinite(rawAmount)) {
    amount = Math.abs(rawAmount);
    const cue = text(valueFor(row, keys.type)).toLowerCase();
    type = rawAmount >= 0 && /credit|deposit|received|income|\bcr\b/.test(cue) ? 'income' : 'expense';
  }
  if (!date || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return null;
  const transactionId = text(valueFor(row, keys.id)).slice(0, 100);
  return { date, amount: normalizeMoney(Math.round(amount * 100) / 100), type, description: desc.slice(0, 160), merchant: desc.slice(0, 100), ...(transactionId ? { transactionId } : {}) };
};
const guessCategory = (item, rules) => {
  const haystack = `${item.description} ${item.merchant}`.toUpperCase();
  for (const category of rules) {
    const tokens = [category.name, ...(category.rules || [])].map((x) => String(x).toUpperCase()).filter(Boolean);
    if (tokens.some((word) => haystack.includes(word))) return category.name;
  }
  if (/ZOMATO|SWIGGY|RESTAURANT|CAFE|FOOD|DINNER|GROCERY|BLINKIT/.test(haystack)) return 'Food';
  if (/UBER|OLA|METRO|TAXI|FUEL|PETROL|RAPIDO|IRCTC/.test(haystack)) return 'Travel';
  if (/HOSTEL|RENT/.test(haystack)) return 'Rent / Hostel';
  if (/NETFLIX|SPOTIFY|PRIME|MOVIE/.test(haystack)) return 'Entertainment';
  if (/AMAZON|FLIPKART|SHOP/.test(haystack)) return 'Shopping';
  if (/AIRTEL|JIO|ELECTRIC|BILL|WIFI|BROADBAND/.test(haystack)) return 'Bills';
  if (/GYM|FITNESS/.test(haystack)) return 'Fitness';
  return item.type === 'income' ? 'Parents' : 'Other';
};
router.use(authenticate);
router.post('/statement', (req, res, next) => upload.single('statement')(req, res, (err) => err ? next(err) : next()), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Select a statement file to continue.' });
    const extension = req.file.originalname.split('.').pop().toLowerCase();
    const digest = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    let rows = [];
    if (extension === 'csv') {
      try { rows = parse(req.file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, trim: true }); }
      catch { return res.status(422).json({ message: 'We couldn’t read this CSV. Check its headers and row formatting.' }); }
    }
    if (extension === 'xlsx') {
      try { rows = await readXlsxRows(req.file.buffer); }
      catch { return res.status(422).json({ message: 'We couldn’t read this Excel workbook. Upload a valid .xlsx file.' }); }
    }
    if (extension === 'pdf') {
      let parsed;
      try { parsed = await pdfParse(req.file.buffer); }
      catch { return res.status(422).json({ message: 'We couldn’t read this PDF. Try exporting a text-based bank statement.' }); }
      const linePattern = /(\d{1,2}(?:\/|-)\d{1,2}(?:\/|-)\d{2,4})\s+(.+?)\s+([+-]?[\d,]+\.\d{2})\s*$/;
      rows = parsed.text.split(/\r?\n/).map((line) => {
        const match = line.trim().match(linePattern);
        return match ? { date: match[1], description: match[2], amount: match[3], type: /\b(cr|credit)\b/i.test(line) ? 'credit' : '' } : null;
      }).filter(Boolean);
    }
    const categories = await Category.find({ userId: req.user._id }).lean();
    const previousFile = await ImportedStatement.findOne({ userId: req.user._id, fileHash: digest });
    const existing = await Transaction.find({ userId: req.user._id }).select('date amount type description merchant transactionId').lean();
    const seen = new Set(existing.flatMap(transactionSignatures));
    const normalized = rows.map(normalizeRow).filter(Boolean);
    if (!normalized.length) return res.status(422).json({ message: 'We couldn’t find transaction rows in this statement. Check its columns or try a text-based PDF.' });
    const seenBatch = new Set();
    const transactions = normalized.map((item, index) => {
      const sigs = transactionSignatures(item); const duplicate = previousFile || sigs.some((sig) => seen.has(sig) || seenBatch.has(sig)); sigs.forEach((sig) => seenBatch.add(sig));
      return { ...item, category: guessCategory(item, categories), paymentMethod: req.user.paymentMethods?.includes('Bank transfer') ? 'Bank transfer' : (req.user.paymentMethods?.[0] || 'Other'), source: 'bank statement', selected: !duplicate, duplicate, rowKey: `${digest.slice(0, 12)}-${index}` };
    });
    res.json({ uploadId: digest, filename: req.file.originalname, total: transactions.length, incomeCount: transactions.filter((t) => t.type === 'income').length, expenseCount: transactions.filter((t) => t.type === 'expense').length, transactions, duplicateFile: Boolean(previousFile) });
  } catch (err) { next(err); }
});

router.post('/confirm', async (req, res, next) => {
  try {
    const { uploadId, filename, transactions = [] } = req.body;
    if (!/^[\da-f]{64}$/i.test(String(uploadId || ''))) return res.status(400).json({ message: 'Import review has expired. Upload the statement again.' });
    if (!Array.isArray(transactions) || transactions.length > 3000) return res.status(400).json({ message: 'Select up to 3,000 transactions per import.' });
    const alreadyImported = await ImportedStatement.exists({ userId: req.user._id, fileHash: uploadId });
    if (alreadyImported) return res.status(409).json({ message: 'This statement has already been imported.' });
    const existing = await Transaction.find({ userId: req.user._id }).select('date amount type description merchant transactionId').lean();
    const seen = new Set(existing.flatMap(transactionSignatures)); const accepted = [];
    const categories = await Category.find({ userId: req.user._id }).lean();
    for (const row of transactions) {
      if (!row.selected || row.duplicate) continue;
      const validation = validateTransaction(row);
      if (validation) return res.status(400).json({ message: validation });
      const clean = { ...row, date: new Date(row.date), amount: normalizeMoney(row.amount), source: 'bank statement', paymentMethod: String(row.paymentMethod || req.user.paymentMethods?.[0] || 'Other').slice(0, 40), description: text(row.description).slice(0, 160), merchant: text(row.merchant).slice(0, 100) };
      if (!categories.some((category) => category.name === clean.category && (category.type === 'both' || category.type === clean.type))) return res.status(400).json({ message: `Choose a valid ${clean.type} category for “${clean.description || clean.merchant}”.` });
      if (!req.user.paymentMethods?.includes(clean.paymentMethod)) return res.status(400).json({ message: 'Choose a payment method from your settings.' });
      const sigs = transactionSignatures(clean); if (sigs.some((sig) => seen.has(sig))) continue;
      sigs.forEach((sig) => seen.add(sig)); accepted.push({ ...clean, userId: req.user._id });
    }
    if (accepted.length) {
      await Transaction.insertMany(accepted, { ordered: false });
      const now = new Date(); const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const importedExpenses = sumMoney(accepted.filter((row) => row.type === 'expense' && row.date >= startOfMonth && row.date <= now).map((row) => row.amount));
      if (importedExpenses) await notifyBudgetCrossings(req.user._id, { type: 'expense', amount: importedExpenses, date: now });
      const ruleUpdates = new Map();
      accepted.filter((row) => row.rememberRule && row.merchant).forEach((row) => {
        const rule = text(row.merchant).slice(0, 60).toUpperCase();
        if (rule && rule.length >= 3) ruleUpdates.set(row.category, [...new Set([...(ruleUpdates.get(row.category) || []), rule])]);
      });
      for (const [category, rules] of ruleUpdates) await Category.updateOne({ userId: req.user._id, name: category }, { $addToSet: { rules: { $each: rules } } });
    }
    if (accepted.length) await ImportedStatement.create({ userId: req.user._id, filename: text(filename || 'statement').slice(0, 180), fileHash: uploadId, rowCount: accepted.length });
    res.status(201).json({ imported: accepted.length, skipped: transactions.length - accepted.length });
  } catch (err) { next(err); }
});
export default router;
