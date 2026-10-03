import { money } from '../services/api';

export const budgetState = (percent) => percent > 100 ? 'OVER LIMIT' : percent >= 90 ? 'HIGH' : percent >= 70 ? 'MEDIUM' : 'LOW';
export default function BudgetProgress({ label, spent = 0, limit = 0, compact = false, currency = 'INR' }) {
  const percent = limit > 0 ? Math.round(spent / limit * 100) : 0; const state = budgetState(percent);
  return <div className={`budget-progress ${compact ? 'compact' : ''}`}><div className="budget-progress-top"><div><span>{label}</span>{!compact && <small>{state}</small>}</div><b>{limit ? `${percent}%` : 'Not set'}</b></div><div className="progress-track"><i className={`progress-${state.toLowerCase().replace(' ', '-')}`} style={{ width: `${Math.min(percent, 100)}%` }} /></div><div className="budget-progress-foot"><span>{`${money(spent, currency)} spent`}</span><span>{limit ? `of ${money(limit, currency)}` : 'Set a limit'}</span></div></div>;
}
