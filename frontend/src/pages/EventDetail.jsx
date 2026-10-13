import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../toast.jsx';
import EventCover from '../components/EventCover.jsx';
import { Empty, ErrorNote, Spinner } from '../components/Common.jsx';
import { fmtDate, fmtRange, fmtShortDate, isPast, seatsLeft, timeAgo } from '../format.js';

function Attendees({ event }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api.get(`/events/${event.id}/attendees`).then((d) => setRows(d.attendees)).catch(setError);
  }, [event.id, event.registrationCount]);

  const download = async () => {
    try {
      const res = await api.raw(`/events/${event.id}/attendees.csv`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (res.headers.get('Content-Disposition') || '').match(/filename="(.+)"/)?.[1] || 'attendees.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Attendees ({rows?.length ?? event.registrationCount})</h2>
        <button className="btn btn-ghost btn-sm" onClick={download} disabled={!rows?.length}>
          Download CSV
        </button>
      </div>
      <ErrorNote error={error} />
      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <p className="muted">Nobody has registered yet. Share the event link to get the word out.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Registered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>
                    <a href={`mailto:${a.email}`}>{a.email}</a>
                  </td>
                  <td className="muted">{fmtShortDate(a.registeredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Comments({ event }) {
  const { user } = useAuth();
  const toast = useToast();
  const [comments, setComments] = useState(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/events/${event.id}/comments`).then((d) => setComments(d.comments)).catch(() => setComments([]));
  }, [event.id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const d = await api.post(`/events/${event.id}/comments`, { body });
      setComments((c) => [d.comment, ...c]);
      setBody('');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.del(`/comments/${id}`);
      setComments((c) => c.filter((x) => x.id !== id));
      toast('Comment deleted');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <section className="panel">
      <h2>Questions & comments</h2>
      {user ? (
        <form onSubmit={submit} className="comment-form">
          <label htmlFor="comment" className="sr-only">
            Write a comment
          </label>
          <textarea
            id="comment"
            rows={3}
            maxLength={1000}
            placeholder="Ask the organiser a question or leave a note for other attendees"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" disabled={busy || !body.trim()}>
            {busy ? 'Posting…' : 'Post comment'}
          </button>
        </form>
      ) : (
        <p className="muted">
          <Link to="/login">Sign in</Link> to ask a question.
        </p>
      )}
      {!comments ? (
        <Spinner />
      ) : comments.length === 0 ? (
        <p className="muted">No comments yet.</p>
      ) : (
        <ul className="comments">
          {comments.map((c) => {
            const canDelete = user && (user.id === c.author.id || user.role === 'admin' || event.canManage);
            const isOrganizer = c.author.id === event.organizer.id;
            return (
              <li key={c.id} className="comment">
                <div className="comment-head">
                  <strong>{c.author.name}</strong>
                  {isOrganizer && <span className="pill pill-ink">Organiser</span>}
                  <small className="muted">{timeAgo(c.createdAt)}</small>
                  {canDelete && (
                    <button className="link-btn danger push-right" onClick={() => remove(c.id)}>
                      Delete
                    </button>
                  )}
                </div>
                <p>{c.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(() => {
    api
      .get(`/events/${id}`)
      .then((d) => setEvent(d.event))
      .catch(setError);
  }, [id]);

  useEffect(() => {
    setEvent(null);
    setError(null);
    load();
  }, [load, user?.id]);

  if (error?.status === 404)
    return (
      <div className="page narrow">
        <Empty title="This event doesn't exist" action={<Link className="btn btn-primary" to="/">Browse events</Link>}>
          It may have been removed by its organiser.
        </Empty>
      </div>
    );
  if (error)
    return (
      <div className="page narrow">
        <ErrorNote error={error} />
      </div>
    );
  if (!event) return <Spinner />;

  const past = isPast(event);
  const cancelled = event.status === 'cancelled';
  const left = seatsLeft(event);
  const isOrganizer = user?.id === event.organizer.id;
  const fill = Math.min(100, Math.round((event.registrationCount / event.capacity) * 100));

  const act = async (fn, success) => {
    setBusy(true);
    try {
      await fn();
      if (success) toast(success);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const register = () =>
    act(async () => {
      const d = await api.post(`/events/${event.id}/register`);
      setEvent((e) => ({ ...e, ...d.event }));
    }, "You're registered. We'll notify you about any changes.");

  const unregister = () =>
    act(async () => {
      const d = await api.del(`/events/${event.id}/register`);
      setEvent((e) => ({ ...e, ...d.event }));
    }, 'Registration cancelled.');

  const cancelEvent = () =>
    act(async () => {
      const d = await api.post(`/events/${event.id}/cancel`);
      setEvent((e) => ({ ...e, ...d.event }));
    }, 'Event cancelled. Attendees have been notified.');

  const deleteEvent = () =>
    act(async () => {
      await api.del(`/events/${event.id}`);
      navigate('/dashboard');
    }, 'Event deleted.');

  let action;
  if (cancelled) action = <p className="status-note danger">This event was cancelled by the organiser.</p>;
  else if (past) action = <p className="status-note">This event has ended.</p>;
  else if (!user)
    action = (
      <Link className="btn btn-primary btn-block" to="/login" state={{ from: `/events/${event.id}` }}>
        Sign in to register
      </Link>
    );
  else if (isOrganizer) action = <p className="status-note">You're organising this event.</p>;
  else if (event.isRegistered)
    action = (
      <>
        <p className="status-note success">You're going.</p>
        <button className="btn btn-ghost btn-block" disabled={busy} onClick={unregister}>
          Cancel my registration
        </button>
      </>
    );
  else if (left === 0) action = <p className="status-note danger">This event is full.</p>;
  else
    action = (
      <button className="btn btn-primary btn-block" disabled={busy} onClick={register}>
        {busy ? 'Registering…' : 'Register for free'}
      </button>
    );

  return (
    <div className="page detail">
      <Link to="/" className="back">
        Back to events
      </Link>
      <div className="detail-grid">
        <div className="detail-main">
          <EventCover event={event} size="hero" />
          <p className="event-card-cat detail-cat">{event.category}</p>
          <h1 className="detail-title">{event.title}</h1>
          {cancelled && <span className="pill pill-danger">Cancelled</span>}
          <div className="prose">
            {event.description.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          <div className="organizer">
            <span className="avatar avatar-lg">{event.organizer.name.slice(0, 1)}</span>
            <div>
              <small className="muted">Organised by</small>
              <strong>{event.organizer.name}</strong>
              {event.organizer.bio && <p className="muted">{event.organizer.bio}</p>}
            </div>
          </div>

          {event.canManage && <Attendees event={event} />}
          <Comments event={event} />
        </div>

        <aside className="detail-side">
          <div className="ticket">
            <dl className="facts">
              <div>
                <dt>Date</dt>
                <dd>{fmtDate(event.startTime)}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{fmtRange(event.startTime, event.endTime)}</dd>
              </div>
              <div>
                <dt>Where</dt>
                <dd>
                  {event.location}
                  <br />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Maps
                  </a>
                </dd>
              </div>
              <div>
                <dt>Spots</dt>
                <dd>
                  {event.registrationCount} of {event.capacity} taken
                  <div className="meter meter-lg" aria-hidden="true">
                    <span style={{ width: `${fill}%` }} />
                  </div>
                </dd>
              </div>
            </dl>
            <div className="ticket-action">{action}</div>
          </div>

          {event.canManage && (
            <div className="panel manage">
              <h2>Manage event</h2>
              <Link className="btn btn-ghost btn-block" to={`/events/${event.id}/edit`}>
                Edit details
              </Link>
              {!cancelled && !past && (
                <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => setConfirm('cancel')}>
                  Cancel event
                </button>
              )}
              <button className="btn btn-danger-ghost btn-block" disabled={busy} onClick={() => setConfirm('delete')}>
                Delete event
              </button>
              {confirm && (
                <div className="confirm" role="alertdialog" aria-label="Confirm">
                  <p>
                    {confirm === 'cancel'
                      ? `Cancel this event? All ${event.registrationCount} attendees will be notified.`
                      : 'Delete this event permanently? Registrations and comments will be removed.'}
                  </p>
                  <div className="row">
                    <button className="btn btn-danger btn-sm" disabled={busy} onClick={confirm === 'cancel' ? cancelEvent : deleteEvent}>
                      {confirm === 'cancel' ? 'Cancel event' : 'Delete event'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>
                      Keep it
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
