import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return (
    <div className="alert" role="alert">
      {error.message || String(error)}
    </div>
  );
}

export function Field({ label, hint, error, children, id }) {
  return (
    <div className={`field${error ? ' field-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <p className="field-msg">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

/** Redirects to /login if signed out; optionally restricts by role. */
export function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="page narrow">
        <Empty title="You don't have access to this page">
          This area is for {roles.join(' and ')} accounts.
        </Empty>
      </div>
    );
  }
  return children;
}

/** Map API validation details to { field: message } for inline errors. */
export function fieldErrors(err) {
  const out = {};
  for (const d of err?.details || []) if (d.field && !out[d.field]) out[d.field] = d.message;
  return out;
}
