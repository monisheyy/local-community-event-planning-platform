import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../toast.jsx';
import { ErrorNote, Spinner } from '../components/Common.jsx';
import { fmtShortDate } from '../format.js';

export default function Admin() {
  const { user } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    api.get('/users').then((d) => setUsers(d.users)).catch(setError);
  }, []);

  const changeRole = async (id, role) => {
    try {
      await api.patch(`/users/${id}/role`, { role });
      setUsers((list) => list.map((u) => (u.id === id ? { ...u, role } : u)));
      toast('Role updated.');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const shown = (users || []).filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="page">
      <h1 className="page-title">Manage users</h1>
      <p className="muted lead">Promote trusted members to organisers, or hand over admin access.</p>
      <ErrorNote error={error} />
      {!users ? (
        <Spinner />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h2>{users.length} members</h2>
            <label className="sr-only" htmlFor="filter">
              Filter users
            </label>
            <input id="filter" className="input-sm" placeholder="Filter by name or email" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Events</th>
                  <th scope="col">Sign-ups</th>
                  <th scope="col">Role</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td className="muted">{u.email}</td>
                    <td className="nowrap">{fmtShortDate(u.createdAt)}</td>
                    <td>{u.eventCount}</td>
                    <td>{u.registrationCount}</td>
                    <td>
                      <label className="sr-only" htmlFor={`role-${u.id}`}>
                        Role for {u.name}
                      </label>
                      <select id={`role-${u.id}`} className="input-sm" value={u.role} disabled={u.id === user.id} onChange={(e) => changeRole(u.id, e.target.value)}>
                        <option value="participant">participant</option>
                        <option value="organizer">organizer</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
