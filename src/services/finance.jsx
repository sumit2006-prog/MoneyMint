import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { post, put } from './api';

const FinanceContext = createContext(null);
export function FinanceProvider({ children }) {
  const { user } = useAuth();
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const refresh = useCallback(() => setRevision((x) => x + 1), []);
  const notify = useCallback((message, tone = 'success') => { setToast({ message, tone, id: Date.now() }); window.setTimeout(() => setToast(null), 3500); }, []);
  const openTransaction = useCallback((transaction = null, initialType = 'expense') => setDialog({ transaction, initialType }), []);
  const closeTransaction = useCallback(() => setDialog(null), []);
  const saveTransaction = useCallback(async (values) => {
    const route = values.type === 'income' ? '/income' : '/transactions';
    const result = dialog?.transaction?._id ? await put(`${route}/${dialog.transaction._id}`, values) : await post(route, values);
    setDialog(null); refresh(); notify(dialog?.transaction ? 'Transaction updated.' : `${values.type === 'income' ? 'Income' : 'Expense'} added.`); return result;
  }, [dialog, notify, refresh]);
  const value = useMemo(() => ({ revision, refresh, openTransaction, dialog, closeTransaction, saveTransaction, toast, notify, user }), [revision, refresh, openTransaction, dialog, closeTransaction, saveTransaction, toast, notify, user]);
  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}
export const useFinance = () => useContext(FinanceContext);
