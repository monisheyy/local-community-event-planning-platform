import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Empty, ErrorNote, Spinner } from '../components/Common.jsx';
import EventCover from '../components/EventCover.jsx';
import { fmtDay, fmtMonth, fmtShortDate, fmtTime, fmtWeekday } from '../format.js';

function MyRegistrations() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.get('/users/me/registrations').then((d) => setRows(d.registrations)).catch(setError);
  }, []);
  if (error) return <ErrorNote error={error} />;
  if (!rows) return <Spinner />;
  const now = new Date();
  const upcoming = rows.filter((r) => new Date(r.end_time) >= now);
  const past = rows.filter((r) => new Date(r.end_time) < now).reverse();

  const Row = ({ r }) => (
    <li>
      <Link to={`/events/${r.id}`} className="agenda-row">
        <div className="agenda-date">
          <span>{fmtMonth(r.start_time)}</span>
          <strong>{fmtDay(r.start_time)}</strong>
        </div>
        <div className="agenda-body">
          <strong>{r.title}</strong>
          <span className="muted">
            {fmtWeekday(r.start_time)}, {fmtTime(r.start_time)}. {r.location}
          </span>
        </div>
        {r.status === 'cancelled' && <span className="pill pill-danger">Cancelled</span>}
      </Link>
    </li>
  );

  return (
    <section className="panel">
      <h2>Events I'm going to</h2>
      {upcoming.length === 0 ? (
        <Empty title="Nothing on your calendar yet" action={<Link className="btn btn-primary" to="/">Find an event</Link>} />
      ) : (
        <ul className="agenda">{upcoming.map((r) => <Row key={r.id} r={r} />)}</ul>
      )}
      {past.length > 0 && (
        <>
          <h3 className="sub-head">Past events</h3>
          <ul className="agenda agenda-past">{past.map((r) => <Row key={r.id} r={r} />)}</ul>
        </>
      )}
    </section>
  );
}

function MyEvents() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.get('/users/me/events').then((d) => setRows(d.events)).catch(setError);
  }, []);
  if (error) return <ErrorNote error={error} />;
  if (!rows) return <Spinner />;

  const now = new Date();
  const live = rows.filter((r) => r.status === 'published' && new Date(r.end_time) >= now);
  const totalRegs = rows.reduce((s, r) => s + Number(r.registration_count), 0);
  const totalCap = live.reduce((s, r) => s + r.capacity, 0);
  const liveRegs = live.reduce((s, r) => s + Number(r.registration_count), 0);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Events I organise</h2>
        <Link to="/events/new" className="btn btn-primary btn-sm">
          Create event
        </Link>
      </div>
      <div className="figures">
        <div>
          <strong>{live.length}</strong>
          <span>upcoming events</span>
        </div>
        <div>
          <strong>{totalRegs}</strong>
          <span>total sign-ups</span>
        </div>
        <div>
          <strong>{totalCap ? Math.round((liveRegs / totalCap) * 100) : 0}%</strong>
          <span>of upcoming spots filled</span>
        </div>
      </div>
      {rows.length === 0 ? (
        <Empty title="You haven't created any events" action={<Link className="btn btn-primary" to="/events/new">Create your first event</Link>} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">Date</th>
                <th scope="col">Sign-ups</th>
                <th scope="col">Comments</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ended = new Date(r.end_time) < now;
                const pct = Math.min(100, Math.round((r.registration_count / r.capacity) * 100));
                return (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/events/${r.id}`} className="table-event">
                        <EventCover event={{ imageUrl: r.image_url, category: r.category }} size="thumb" />
                        <span>{r.title}</span>
                      </Link>
                    </td>
                    <td className="nowrap">{fmtShortDate(r.start_time)}</td>
                    <td>
                      <div className="cell-meter">
                        <span className="nowrap">
                          {r.registration_count} / {r.capacity}
                        </span>
                        <div className="meter" aria-hidden="true">
                          <span style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>{r.comment_count}</td>
                    <td>
                      {r.status === 'cancelled' ? (
                        <span className="pill pill-danger">Cancelled</span>
                      ) : ended ? (
                        <span className="pill">Ended</span>
                      ) : (
                        <span className="pill pill-live">Live</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Dashboard() {
  const { user, canOrganize } = useAuth();
  return (
    <div className="page">
      <h1 className="page-title">Hi, {user.name.split(' ')[0]}</h1>
      <p className="muted lead">
        {canOrganize ? 'Your events and sign-ups at a glance.' : "Here's what you've signed up for."}
      </p>
      <div className="dash">
        {canOrganize && <MyEvents />}
        <MyRegistrations />
      </div>
    </div>
  );
}
