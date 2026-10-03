const API_BASE = import.meta.env.VITE_API_URL || '/api';
export const getToken = () => localStorage.getItem('moneymint_token');
export const dateInputValue = (value = new Date()) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export const dateInputToIso = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date.toISOString() : '';
};

export async function api(path, options = {}) {
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    let message = 'Something went wrong. Please try again.';
    try { const body = await response.json(); message = body.message || message; } catch { /* Friendly fallback for non-JSON errors. */ }
    if (response.status === 401 && token) window.dispatchEvent(new CustomEvent('moneymint:expired'));
    throw new Error(message);
  }
  if (contentType.includes('application/json')) return response.json();
  return response;
}

export const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
export const put = (path, body) => api(path, { method: 'PUT', body: JSON.stringify(body) });
export const remove = (path) => api(path, { method: 'DELETE' });
export const money = (value, currency = 'INR', maximumFractionDigits = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits }).format(Number(value || 0));
export const monthLabel = (value) => new Date(`${value}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'short' });
export const dateLabel = (value, options = { day: 'numeric', month: 'short' }) => {
  const date = new Date(value);
  const format = localStorage.getItem('moneymint_date_format') || 'dd MMM yyyy';
  if (format === 'dd/MM/yyyy') return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  if (format === 'MM/dd/yyyy') return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
  return new Intl.DateTimeFormat('en-IN', options).format(date);
};
