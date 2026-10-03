import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CirclePlus, PiggyBank, TrendingDown, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, money } from '../services/api';
import { useAuth } from '../services/auth';
import { useFinance } from '../services/finance';
import Loading from '../components/Loading';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import BudgetProgress from '../components/BudgetProgress';
import TransactionList from '../components/TransactionList';
import EmptyState from '../components/EmptyState';
import SpendingGauge from '../components/SpendingGauge';
import { spendingGaugeStatus } from '../lib/spendingGauge';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
export default function Dashboard() {
  const { user } = useAuth(); const { revision, openTransaction } = useFinance(); const navigate = useNavigate();
  const [data, setData] = useState(null); const [budgets, setBudgets] = useState([]); const [transactions, setTransactions] = useState([]); const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    Promise.all([api('/analytics'), api('/budgets'), api('/transactions?limit=5')]).then(([analytics, budgetResult, tx]) => { if (alive) { setData(analytics); setBudgets(budgetResult.budgets); setTransactions(tx.transactions); setError(''); } }).catch((err) => alive && setError(err.message));
    return () => { alive = false; };
  }, [revision]);
  if (!data && !error) return <Loading rows={4} />;
  const byType = Object.fromEntries(budgets.map((b) => [b.type, b])); const monthly = byType.monthly;
  const monthlyLimit = Number(monthly?.limit);
  const monthlySpent = Number(monthly?.spent);
  const monthlyUsage = Number.isFinite(monthlyLimit) && monthlyLimit > 0 ? Math.max(0, (Number.isFinite(monthlySpent) ? monthlySpent : 0) / monthlyLimit * 100) : null;
  const status = monthlyUsage === null ? 'READY' : spendingGaugeStatus(monthlyUsage);
  return <div className="dashboard-page">
    <PageHeader eyebrow={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()} title={`${greeting()}, ${user?.name?.split(' ')[0] || 'there'} 👋`} description="A clear little snapshot of how you're doing." action={<button className="button primary" onClick={() => openTransaction()}><CirclePlus size={17} /> Add transaction</button>} />
    {error && <div className="inline-alert">{error} <button onClick={() => window.location.reload()}>Try again</button></div>}
    {data && <>
      <section className="stat-grid">
        <StatCard label="Current balance" value={money(data.totals.balance, user?.currency)} icon={Wallet} tone="forest" hint="Across your recorded transactions" />
        <StatCard label="Income this month" value={money(data.totals.income, user?.currency)} icon={ArrowDownLeft} tone="green" hint="Money in this month" />
        <StatCard label="Spent this month" value={money(data.totals.expenses, user?.currency)} icon={ArrowUpRight} tone="amber" hint="Money out this month" />
        <StatCard label="Saved this month" value={money(data.totals.savings, user?.currency)} icon={PiggyBank} tone="mint" hint={data.totals.income ? `${data.totals.savingsRate}% of this month's income` : 'Add income to see your savings'} />
      </section>
      <section className="dashboard-middle">
        <article className="panel budget-overview"><div className="panel-heading"><div><span className="eyebrow">YOUR PLAN, AT A GLANCE</span><h2>Budget overview</h2></div><button className="link-button" onClick={() => navigate('/budgets')}>Manage budgets <ArrowRight size={15} /></button></div>
          <div className="budget-overview-list"><BudgetProgress compact label="Today" spent={byType.daily?.spent || 0} limit={byType.daily?.limit || 0} currency={user?.currency} /><BudgetProgress compact label="This week" spent={byType.weekly?.spent || 0} limit={byType.weekly?.limit || 0} currency={user?.currency} /><BudgetProgress compact label="This month" spent={monthly?.spent || 0} limit={monthly?.limit || 0} currency={user?.currency} /></div>
          {!budgets.length && <button className="text-link" onClick={() => navigate('/budgets')}>Set your first budget <ArrowRight size={14} /></button>}
        </article>
        <article className={`panel spending-status status-${status.toLowerCase().replace(' ', '-')}`}><div className="status-head"><span className="eyebrow">MONTHLY SPENDING</span><span className="status-icon"><TrendingDown size={17} /></span></div><SpendingGauge percent={monthlyUsage} status={status} /></article>
      </section>
      <section className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">THE LATEST</span><h2>Recent transactions</h2></div><button className="link-button" onClick={() => navigate('/transactions')}>View all <ArrowRight size={15} /></button></div>
        {transactions.length ? <TransactionList items={transactions} compact currency={user?.currency} /> : <EmptyState title="Your money story starts here" text="A few transactions are all it takes to see your money more clearly." action="Add your first transaction" onAction={() => openTransaction()} />}
      </section>
      <p className="dashboard-footnote"><ShieldCheckIcon /> Your money overview is private and only visible to you.</p>
    </>}
  </div>;
}
function ShieldCheckIcon() { return <span className="shield-mini">✓</span>; }
