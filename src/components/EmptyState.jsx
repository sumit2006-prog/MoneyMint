import { Plus } from 'lucide-react';
export default function EmptyState({ title = 'Your money story starts here', text = 'Add a transaction to start building your picture.', action, onAction }) {
  return <div className="empty-state"><img src="/assets/moneymint-logo.png" alt="MoneyMint pig mascot" /><h3>{title}</h3><p>{text}</p>{onAction && <button className="button primary" onClick={onAction}><Plus size={17} />{action || 'Add your first transaction'}</button>}</div>;
}
