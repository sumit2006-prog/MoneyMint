import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { dateInputToIso, dateInputValue } from '../services/api';

const expenseDefaults = ['Food', 'Rent / Hostel', 'Travel', 'Bills', 'Shopping', 'Entertainment', 'Education', 'Fitness', 'Medical', 'Other'];
const incomeDefaults = ['Parents', 'Salary', 'Scholarship', 'Freelancing', 'Gift', 'Other'];
export default function TransactionModal({ dialog, categories = [], paymentMethods = ['UPI', 'Cash', 'Debit Card', 'Credit Card', 'Bank transfer', 'Other'], defaultCategory = 'Food', onClose, onSave }) {
  const tx = dialog?.transaction;
  const [form, setForm] = useState({ type: tx?.type || dialog?.initialType || 'expense', amount: tx?.amount || '', category: tx?.category || defaultCategory, description: tx?.description || '', date: tx?.date ? dateInputValue(tx.date) : dateInputValue(), paymentMethod: tx?.paymentMethod || paymentMethods[0] || 'Other', merchant: tx?.merchant || '', notes: tx?.notes || '' });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const options = useMemo(() => {
    const relevant = categories.filter((c) => c.type === 'both' || c.type === form.type).map((c) => c.name);
    return [...new Set([...(form.type === 'income' ? incomeDefaults : expenseDefaults), ...relevant])];
  }, [categories, form.type]);
  useEffect(() => { if (!options.includes(form.category)) setForm((v) => ({ ...v, category: options[0] || 'Other' })); }, [options, form.category]);
  useEffect(() => { const handler = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [onClose]);
  const change = (e) => setForm((current) => ({ ...current, [e.target.name]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) return setError('Enter an amount greater than zero.');
    setSaving(true);
    try { await onSave({ ...form, amount: Number(form.amount), date: dateInputToIso(form.date) }); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-title">
    <div className="modal-head"><div><span className="eyebrow">MONEY IN, MONEY OUT</span><h2 id="transaction-title">{tx ? 'Edit transaction' : 'Add a transaction'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
    <form onSubmit={submit}>
      <div className="segmented"><button type="button" className={form.type === 'expense' ? 'active expense-tab' : ''} onClick={() => setForm({ ...form, type: 'expense' })}>Expense</button><button type="button" className={form.type === 'income' ? 'active income-tab' : ''} onClick={() => setForm({ ...form, type: 'income' })}>Income</button></div>
      <label className="amount-field"><span>Amount</span><div><b>₹</b><input name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" autoFocus placeholder="0.00" value={form.amount} onChange={change} required /></div></label>
      <div className="form-grid"><label>Category<select name="category" value={form.category} onChange={change}>{options.map((item) => <option key={item}>{item}</option>)}</select></label><label>Date<input name="date" type="date" value={form.date} onChange={change} required /></label><label>Payment method<select name="paymentMethod" value={form.paymentMethod} onChange={change}>{paymentMethods.map((item) => <option key={item}>{item}</option>)}</select></label><label>Merchant <span className="optional">optional</span><input name="merchant" value={form.merchant} onChange={change} placeholder="e.g. Zomato" maxLength="100" /></label><label className="full-field">Description<input name="description" value={form.description} onChange={change} placeholder="What was it for?" maxLength="160" /></label><label className="full-field">Notes <span className="optional">optional</span><textarea name="notes" value={form.notes} onChange={change} placeholder="Anything else to remember?" maxLength="500" rows="2" /></label></div>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions"><button type="button" className="button subtle" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : tx ? 'Save changes' : 'Add transaction'}</button></div>
    </form>
  </section></div>;
}
