import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getToken, post } from './api';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const navigate = useNavigate();
  const logout = useCallback(() => { localStorage.removeItem('moneymint_token'); setUser(null); navigate('/login'); }, [navigate]);
  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api('/auth/me').then((result) => setUser(result.user)).catch(() => { localStorage.removeItem('moneymint_token'); setUser(null); }).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const expired = () => logout(); window.addEventListener('moneymint:expired', expired);
    return () => window.removeEventListener('moneymint:expired', expired);
  }, [logout]);
  const signIn = useCallback(async (payload, path) => {
    const result = await post(`/auth/${path}`, payload); localStorage.setItem('moneymint_token', result.token); setUser(result.user); navigate('/');
  }, [navigate]);
  const updateUser = useCallback((next) => setUser((current) => ({ ...current, ...next })), []);
  const value = useMemo(() => ({ user, loading, signIn, logout, updateUser }), [user, loading, signIn, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
