import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
export default function StatCard({ label, value, icon: Icon = Wallet, tone = 'mint', hint, change }) {
  return <article className={`stat-card stat-${tone}`}><div className="stat-top"><span className="stat-icon"><Icon size={18} /></span>{change !== undefined && <span className={`stat-change ${change >= 0 ? 'positive' : 'negative'}`}>{change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(change)}%</span>}</div><span className="stat-label">{label}</span><strong>{value}</strong><small>{hint}</small></article>;
}
