import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Lightbulb, PiggyBank, Sparkles, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { api, money } from '../services/api';
import { useAuth } from '../services/auth';
import { useFinance } from '../services/finance';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import EmptyState from '../components/EmptyState';
const iconFor = (name) => ({ sparkles: Sparkles, 'trending-up': TrendingUp, 'trending-down': TrendingDown, target: Target, 'piggy-bank': PiggyBank })[name] || Lightbulb;
export default function Insights() {
  const { revision, openTransaction } = useFinance(); const { user } = useAuth(); const [data, setData] = useState(null); const [error, setError] = useState('');
  useEffect(() => { let active = true; api('/insights').then((r) => active && (setData(r), setError(''))).catch((e) => active && setError(e.message)); return () => { active = false; }; }, [revision]);
  if (!data && !error) return <Loading rows={4} />;
  return <div className="insights-page"><PageHeader eyebrow="THE LITTLE THINGS THAT ADD UP" title="Money insights" description="Helpful context, based on the transactions you’ve recorded." />{error && <div className="inline-alert">{error}</div>}{data && <>
    {data.insights.length ? <section className="insight-grid">{data.insights.map((insight, index) => { const Icon = iconFor(insight.icon); const text = insight.text.replace(/(?<![\w%])(\d[\d,]*(?:\.\d+)?)(?!%)/g, (match) => money(Number(match.replaceAll(',', '')), user?.currency)); return <article className={`insight-card insight-${insight.tone}`} key={`${insight.title}-${index}`}><div className="insight-icon"><Icon size={19} /></div><span className="insight-kicker">{['SPENDING', 'MONTHLY CHANGE', 'BUDGET PACE', 'SAVINGS'][index] || 'YOUR MONEY'}</span><h2>{insight.title}</h2><p>{text}</p></article>; })}</section> : <EmptyState title="Not enough data yet to generate this insight." text="Add some transactions to see spending patterns based on your account." action="Add a transaction" onAction={() => openTransaction()} />}
    {data.categories.length > 0 && <section className="panel why-panel"><div className="panel-heading"><div><span className="eyebrow">A CLOSER LOOK</span><h2>Why did my spending change?</h2></div><span className="subtle-badge">Month over month</span></div><div className="change-list">{data.categories.map((item) => { const previous = data.previousCategories.find((p) => p.category === item.category)?.amount || 0; const diff = item.amount - previous; return <div className="change-row" key={item.category}><span className={`change-indicator ${diff > 0 ? 'up' : 'down'}`}>{diff > 0 ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}</span><div><strong>{item.category}</strong><p>{previous ? `${item.category} spending ${diff > 0 ? 'increased' : diff < 0 ? 'decreased' : 'stayed the same'} by ${money(Math.abs(diff), user?.currency)} compared with last month.` : `You’ve spent ${money(item.amount, user?.currency)} on ${item.category.toLowerCase()} this month.`}</p></div><b className={diff > 0 ? 'text-warm' : 'text-green'}>{money(item.amount, user?.currency)}</b></div>; })}</div></section>}
  </>}</div>;
}
