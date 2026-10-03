export default function Loading({ rows = 3 }) {
  return <div className="skeleton-stack" aria-label="Loading"><div className="skeleton-brand"><img src="/assets/moneymint-logo.png" alt="MoneyMint" /><span>Preparing your money overview…</span></div><div className="skeleton hero-skeleton" />{Array.from({ length: rows }, (_, i) => <div className="skeleton" key={i} />)}</div>;
}
