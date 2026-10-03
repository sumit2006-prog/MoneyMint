import { Pencil, Trash2 } from 'lucide-react';
import { dateLabel, money } from '../services/api';
export default function TransactionList({ items = [], onEdit, onDelete, compact = false, currency = 'INR' }) {
  if (!items.length) return null;
  return <div className={`transaction-list ${compact ? 'compact-list' : ''}`}>
    {items.map((item) => <div className="transaction-row" key={item._id}><span className={`transaction-symbol ${item.type}`}><span className="category-emoji">{({ Food: '🥑', Travel: '🚌', 'Rent / Hostel': '🏠', Bills: '✳', Shopping: '🛍', Entertainment: '♫', Parents: '♡', Salary: '↗', Scholarship: '✦' })[item.category] || (item.type === 'income' ? '↙' : '•')}</span></span><div className="transaction-details"><strong>{item.description || item.merchant || item.category}</strong><span>{item.category} <i /> {dateLabel(item.date)}{!compact && ` · ${item.paymentMethod || 'UPI'}`}</span></div><div className={`transaction-value ${item.type}`}>{item.type === 'income' ? '+' : '−'}{money(item.amount, currency)}</div>{!compact && (onEdit || onDelete) && <div className="row-actions">{onEdit && <button className="icon-button" onClick={() => onEdit(item)} title="Edit transaction"><Pencil size={15} /></button>}{onDelete && <button className="icon-button" onClick={() => onDelete(item)} title="Delete transaction"><Trash2 size={15} /></button>}</div>}</div>)}
  </div>;
}
