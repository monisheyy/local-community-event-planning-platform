import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { timeAgo } from '../format.js';

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    const handler = (e) => ref.current && !ref.current.contains(e.target) && onOutside();
    const esc = (e) => e.key === 'Escape' && onOutside();
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [ref, onOutside]);
}

export function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--ink)" />
      <circle cx="32" cy="32" r="6" fill="var(--marigold)" />
      <g fill="none" stroke="var(--marigold)" strokeWidth="4" strokeLinecap="round">
        <path d="M32 12v8M32 44v8M12 32h8M44 32h8M18 18l5.5 5.5M40.5 40.5 46 46M46 18l-5.5 5.5M23.5 40.5 18 46" />
      </g>
    </svg>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ unread: 0, notifications: [] });
  const ref = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  useClickOutside(ref, () => setOpen(false));

  const load = () => api.get('/notifications').then(setData).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [location.pathname]);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.read) await api.post(`/notifications/${n.id}/read`).catch(() => {});
    load();
    if (n.eventId) navigate(`/events/${n.eventId}`);
  };

  const readAll = async () => {
    await api.post('/notifications/read-all');
    load();
  };

  return (
    <div className="menu" ref={ref}>
      <button
        className="icon-btn"
        aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {data.unread > 0 && <span className="badge-dot">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="menu-panel notif-panel">
          <div className="menu-head">
            <strong>Notifications</strong>
            {data.unread > 0 && (
              <button className="link-btn" onClick={readAll}>
                Mark all as read
              </button>
            )}
          </div>
          {data.notifications.length === 0 ? (
            <p className="muted menu-empty">You're all caught up.</p>
          ) : (
            <ul className="notif-list">
              {data.notifications.map((n) => (
                <li key={n.id}>
                  <button className={`notif ${n.read ? '' : 'notif-unread'}`} onClick={() => openItem(n)}>
                    <span>{n.message}</span>
                    <small className="muted">{timeAgo(n.createdAt)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(false));
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="menu" ref={ref}>
      <button className="avatar-btn" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((o) => !o)}>
        <span className="avatar">{initials}</span>
      </button>
      {open && (
        <div className="menu-panel user-panel" onClick={() => setOpen(false)}>
          <div className="menu-head column">
            <strong>{user.name}</strong>
            <small className="muted">
              {user.email} <span className={`role role-${user.role}`}>{user.role}</span>
            </small>
          </div>
          <Link className="menu-item" to="/dashboard">My dashboard</Link>
          <Link className="menu-item" to="/profile">Profile & password</Link>
          {user.role === 'admin' && <Link className="menu-item" to="/admin">Manage users</Link>}
          <button
            className="menu-item"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, canOrganize } = useAuth();
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand">
          <Logo />
          <span>Gather</span>
        </Link>
        <nav className="nav-links" aria-label="Main">
          <NavLink to="/" end>
            Events
          </NavLink>
          {user && <NavLink to="/dashboard">Dashboard</NavLink>}
        </nav>
        <div className="nav-actions">
          {user ? (
            <>
              {canOrganize && (
                <Link to="/events/new" className="btn btn-primary btn-sm hide-sm">
                  Create event
                </Link>
              )}
              <Notifications />
              <UserMenu />
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Join
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
