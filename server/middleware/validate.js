import { normalizeMoney } from '../lib/money.js';

export function parseTransactionDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      const [, year, month, day] = dateOnly;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12);
      if (parsed.getFullYear() !== Number(year) || parsed.getMonth() !== Number(month) - 1 || parsed.getDate() !== Number(day)) return null;
      return parsed;
    }
    if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

export function parseDateBoundary(value, endOfDay = false) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = parseTransactionDate(value);
    if (!parsed) return null;
    return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
  }
  return parseTransactionDate(value);
}

export function validateTransaction(body) {
  body ||= {};
  const amount = normalizeMoney(body?.amount);
  if (amount === null || amount <= 0) return 'Enter an amount greater than zero with no more than two decimal places.';
  if (!['income', 'expense'].includes(body.type)) return 'Choose income or expense.';
  if (!body.category || String(body.category).trim().length > 48) return 'Choose a category.';
  if (body.description && String(body.description).length > 160) return 'Description must be 160 characters or fewer.';
  if (body.merchant && String(body.merchant).length > 100) return 'Merchant must be 100 characters or fewer.';
  if (body.notes && String(body.notes).length > 500) return 'Notes must be 500 characters or fewer.';
  const date = parseTransactionDate(body.date);
  if (!date) return 'Enter a valid transaction date.';
  return null;
}
