import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../services/auth';

export default function AuthPage({ mode }) {
  const signup = mode === 'signup'; const { signIn } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' }); const [showPassword, setShowPassword] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const change = (e) => setForm((v) => ({ ...v, [e.target.name]: e.target.value }));
  const submit = async (e) => { e.preventDefault(); setError(''); setNotice(''); setBusy(true); try { await signIn(form, signup ? 'register' : 'login'); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return <div className="auth-page"><div className="auth-side"><div className="auth-brand"><img src="/assets/moneymint-logo.png" alt="MoneyMint logo" /></div><div className="auth-story"><span className="eyebrow"><Sparkles size={14} /> YOUR MONEY, IN A BETTER LIGHT</span><h1>Small steps.<br /><span>Stronger</span> money habits.</h1><p>A calmer way to see where your money goes, make a plan, and feel good about what comes next.</p><div className="auth-proof"><span><ShieldCheck size={17} /> Private by design</span><i /><span>Made for everyday life</span></div></div><div className="auth-side-foot">TRACK <i /> PLAN <i /> SAVE <i /> GROW</div></div>
    <main className="auth-main"><section className="auth-card"><span className="eyebrow">WELCOME TO MONEY MINT</span><h2>{signup ? 'Create your account' : 'Welcome back'}</h2><p className="auth-subtitle">{signup ? 'A clearer picture of your money starts right here.' : 'Sign in to see how your money is doing.'}</p>
      <form onSubmit={submit}>{signup && <label>Your name<input name="name" value={form.name} onChange={change} placeholder="e.g. Aarav Mehta" autoComplete="name" required minLength="2" maxLength="80" /></label>}<label>Email address<input name="email" value={form.email} onChange={change} placeholder="you@example.com" type="email" autoComplete="email" required /></label><label>Password<div className="password-field"><input name="password" value={form.password} onChange={change} type={showPassword ? 'text' : 'password'} placeholder={signup ? 'At least 8 characters' : 'Your password'} autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 8 : undefined} required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
        {!signup && <div className="auth-between"><label className="checkbox-label"><input type="checkbox" /> Keep me signed in</label><button type="button" className="text-button" onClick={() => setNotice('Password reset is not configured yet. Contact your administrator to reset your account.')}>Forgot password?</button></div>}
        {error && <div className="form-error">{error}</div>}{notice && <div className="form-notice">{notice}</div>}
        <button className="button primary auth-submit" disabled={busy}>{busy ? 'One moment…' : signup ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></button>
      </form>
      <p className="auth-switch">{signup ? 'Already have an account?' : 'New to MoneyMint?'} <Link to={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create an account'}</Link></p><small className="auth-legal">Your information stays yours. We never ask for bank passwords or UPI PINs.</small>
    </section><div className="auth-mobile-brand"><img src="/assets/moneymint-logo.png" alt="MoneyMint" /></div></main></div>;
}
