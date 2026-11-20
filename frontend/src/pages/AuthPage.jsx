import React, { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { api, post } from '../api.js';
import { Field } from '../ui/index.js';

const INITIAL_FORM = {
  email: '',
  password: '',
  full_name: '',
  student_employee_id: '',
  role: 'student',
};

/** Account creation is self-service only for students and faculty/staff. */
export default function AuthPage({ onLogin, notify }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(INITIAL_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState({ status: 'checking' });

  useEffect(() => {
    let mounted = true;
    api('health')
      .then(result => mounted && setHealth({ status: 'ready', ...result }))
      .catch(err => mounted && setHealth({ status: 'error', message: err.message }));
    return () => { mounted = false; };
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') {
        const { token, user } = await post('login', form);
        onLogin(token, user);
      } else {
        await post('register', form);
        notify('Account created. You can now sign in.');
        setForm(current => ({ ...current, password: '' }));
        setMode('login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === 'login';
  const canLogin = health.status !== 'error' && !(health.status === 'ready' && !health.accounts_seeded);

  return (
    <div className="auth-page">
      <section className="auth-panel sorsu-auth-panel" aria-label="Sorsogon State University campus identity">
        <div className="sorsu-auth-head">
          <span className="sorsu-campus-pill">SORSOGON STATE UNIVERSITY</span>
          <span className="sorsu-campus-location">BULAN CAMPUS · SORSOGON</span>
        </div>

        <div className="sorsu-seal-scene">
          <div className="sorsu-seal-stage">
            {/* Motion follows the rotating brushstroke in the supplied reference video. */}
            <svg className="sorsu-brush-orbit" viewBox="0 0 440 440" aria-hidden="true">
              <defs>
                <linearGradient id="sorsu-paint" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ff3873" />
                  <stop offset="0.58" stopColor="#ed0a50" />
                  <stop offset="1" stopColor="#d00038" />
                </linearGradient>
              </defs>
              <path d="M 72 139 C 101 87 163 56 217 46 C 274 35 343 58 378 106" fill="none" stroke="url(#sorsu-paint)" strokeWidth="17" strokeLinecap="round" />
              <path d="M 75 135 Q 66 154 60 176" fill="none" stroke="#f50d56" strokeWidth="9" strokeLinecap="round" />
              <path d="M 378 106 Q 388 120 392 133" fill="none" stroke="#f60b56" strokeWidth="10" strokeLinecap="round" />
            </svg>
            <img className="sorsu-seal" src="/sorsu-seal.png" alt="Sorsogon State University official seal" />
          </div>
        </div>

        <div className="sorsu-auth-caption">
          <span className="sorsu-caption-rule" />
          <p className="sorsu-subheading">Welcome to</p>
          <h1>SorSU–Bulan<br/><span>Campus Park</span></h1>
          <p className="sorsu-auth-description">Secure campus vehicle registration, digital parking permits, and QR-based entry and exit.</p>
        </div>
        <div className="sorsu-auth-footer"><span>OFFICIAL CAMPUS PARKING PORTAL</span><span>1907 · EXCELLENCE IN SERVICE</span></div>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          <span className="auth-chip"><ShieldCheck size={15}/> AUTHORIZED ACCESS</span>
          <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
          <p>{isLogin ? 'Sign in to SorSU–Bulan Campus Park.' : 'Join SorSU–Bulan Campus Park as a student or faculty member.'}</p>

          {health.status === 'error' && <div className="auth-notice error" role="alert">Backend unavailable: {health.message}</div>}
          {health.status === 'ready' && !health.accounts_seeded && <div className="auth-notice" role="status">Database connected. Demo accounts have not been seeded yet.</div>}
          {error && <div className="auth-notice error" role="alert">{error}</div>}

          <form className="stack-form" onSubmit={submit}>
            {!isLogin && <>
              <Field label="Full name"><input name="full_name" value={form.full_name} onChange={updateField} placeholder="Your full name" required/></Field>
              <Field label="Campus ID"><input name="student_employee_id" value={form.student_employee_id} onChange={updateField} placeholder="Student or employee ID" required/></Field>
              <Field label="Account type"><select name="role" value={form.role} onChange={updateField}><option value="student">Student</option><option value="faculty">Faculty / Staff</option></select></Field>
            </>}
            <Field label="Email address"><input type="email" name="email" value={form.email} onChange={updateField} placeholder="name@campus.edu" autoComplete="email" required/></Field>
            <Field label="Password"><input type="password" name="password" value={form.password} onChange={updateField} placeholder="Enter your password" autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={isLogin ? undefined : 8} required/></Field>
            <button className="btn primary auth-submit" disabled={busy || (isLogin && !canLogin)} type="submit">
              {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'} <ArrowRight size={18}/>
            </button>
          </form>

          <p className="switch-mode">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button type="button" onClick={() => { setMode(isLogin ? 'register' : 'login'); setError(''); }}>
              {isLogin ? 'Create an account' : 'Sign in'}
            </button>
          </p>
          <div className="auth-security-note"><LockKeyhole size={16}/> Your access is protected by campus authentication.</div>
        </div>
      </section>
    </div>
  );
}
