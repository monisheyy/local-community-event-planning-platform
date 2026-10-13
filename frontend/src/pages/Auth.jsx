import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useToast } from '../toast.jsx';
import { ErrorNote, Field, fieldErrors } from '../components/Common.jsx';
import { Logo } from '../components/Navbar.jsx';

function AuthShell({ title, sub, children, footer }) {
  return (
    <div className="auth">
      <div className="auth-card card-surface">
        <Logo />
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
        {children}
        <p className="auth-footer muted">{footer}</p>
      </div>
    </div>
  );
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const dest = location.state?.from || '/dashboard';

  if (user) return <Navigate to={dest} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(form.email, form.password);
      toast(`Welcome back, ${u.name.split(' ')[0]}.`);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      sub="Register for events and keep track of what you've signed up for."
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <ErrorNote error={error} />
      <form onSubmit={submit} className="form">
        <Field label="Email" id="email">
          <input id="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" id="password">
          <input id="password" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <details className="demo">
        <summary>Demo accounts</summary>
        <ul>
          {[
            ['Organiser', 'priya@community.local', 'Password123'],
            ['Participant', 'meera@community.local', 'Password123'],
            ['Admin', 'admin@community.local', 'Admin@1234'],
          ].map(([role, email, password]) => (
            <li key={email}>
              <button type="button" className="link-btn" onClick={() => setForm({ email, password })}>
                Use {role.toLowerCase()} account
              </button>
              <small className="muted"> {email}</small>
            </li>
          ))}
        </ul>
      </details>
    </AuthShell>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'participant' });
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  // After sign-up, organisers go straight to creating their first event
  if (user) return <Navigate to={user.role === 'organizer' ? '/events/new' : '/'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const u = await register(form);
      toast(`Welcome to Gather, ${u.name.split(' ')[0]}.`);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <AuthShell
      title="Create your account"
      sub="It's free. Pick how you want to take part. You can attend events either way."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <ErrorNote error={error} />
      <form onSubmit={submit} className="form">
        <fieldset className="role-pick">
          <legend className="sr-only">Account type</legend>
          {[
            ['participant', 'I want to join events', 'Browse, register and comment.'],
            ['organizer', 'I want to organise events', 'Everything above, plus create and manage events.'],
          ].map(([value, title, desc]) => (
            <label key={value} className={`role-option ${form.role === value ? 'on' : ''}`}>
              <input type="radio" name="role" value={value} checked={form.role === value} onChange={set('role')} />
              <strong>{title}</strong>
              <small className="muted">{desc}</small>
            </label>
          ))}
        </fieldset>
        <Field label="Full name" id="name" error={errors.name}>
          <input id="name" autoComplete="name" required value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Email" id="email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" id="password" error={errors.password} hint="At least 8 characters, with a letter and a number.">
          <input id="password" type="password" autoComplete="new-password" required value={form.password} onChange={set('password')} />
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
