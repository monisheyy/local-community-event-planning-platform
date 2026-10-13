import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import EventCard from '../components/EventCard.jsx';
import { categoryColor } from '../components/EventCover.jsx';
import { Empty, ErrorNote, Spinner } from '../components/Common.jsx';

export default function Home() {
  const { user, canOrganize } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const when = params.get('when') || 'upcoming';
  const page = Number(params.get('page') || 1);

  const [search, setSearch] = useState(q);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/events/categories').then((d) => setCategories(d.categories)).catch(() => {});
    api.get('/stats').then(setStats).catch(() => {});
  }, []);

  useEffect(() => setSearch(q), [q]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get('/events', { q, category, when, page, pageSize: 9 })
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [q, category, when, page]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <h1 className="hero-title">What's on in your neighbourhood</h1>
          <p className="hero-sub">
            Beach clean-ups, coding meetups, yoga in the park. Find something to join this week, or organise your own.
          </p>
          <form
            className="search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: search.trim() });
            }}
          >
            <label htmlFor="search" className="sr-only">
              Search events
            </label>
            <input
              id="search"
              type="search"
              placeholder="Search events or places"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn-primary" type="submit">
              Search
            </button>
          </form>
          {stats && (
            <p className="hero-stats">
              <strong>{stats.upcomingEvents}</strong> upcoming events, <strong>{stats.members}</strong> neighbours,{' '}
              <strong>{stats.registrations}</strong> sign-ups so far
            </p>
          )}
        </div>
      </section>

      <div className="page">
        <div className="filters">
          <div className="chips" role="group" aria-label="Filter by category">
            <button className={`chip ${!category ? 'chip-on' : ''}`} onClick={() => update({ category: '' })}>
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                className={`chip ${category === c ? 'chip-on' : ''}`}
                style={{ '--chip-dot': categoryColor(c).bg }}
                onClick={() => update({ category: category === c ? '' : c })}
              >
                <span className="chip-dot" aria-hidden="true" />
                {c}
              </button>
            ))}
          </div>
          <div className="segmented" role="tablist" aria-label="Time">
            {[
              ['upcoming', 'Upcoming'],
              ['past', 'Past'],
            ].map(([v, label]) => (
              <button key={v} role="tab" aria-selected={when === v} className={when === v ? 'on' : ''} onClick={() => update({ when: v })}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {q && (
          <p className="result-line">
            Results for <strong>"{q}"</strong>{' '}
            <button className="link-btn" onClick={() => update({ q: '' })}>
              Clear search
            </button>
          </p>
        )}

        <ErrorNote error={error} />
        {loading && !data ? (
          <Spinner />
        ) : data && data.events.length === 0 ? (
          <Empty
            title={q || category ? 'No events match these filters' : when === 'past' ? 'No past events yet' : 'No upcoming events yet'}
            action={
              canOrganize ? (
                <Link className="btn btn-primary" to="/events/new">
                  Create an event
                </Link>
              ) : !user ? (
                <Link className="btn btn-primary" to="/register">
                  Join to organise one
                </Link>
              ) : null
            }
          >
            {q || category ? 'Try a different search or category.' : 'Be the first to put something on the calendar.'}
          </Empty>
        ) : (
          data && (
            <>
              <div className={`grid ${loading ? 'is-loading' : ''}`}>
                {data.events.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
              {data.totalPages > 1 && (
                <nav className="pager" aria-label="Pagination">
                  <button className="btn btn-ghost" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>
                    Previous
                  </button>
                  <span className="muted">
                    Page {page} of {data.totalPages}
                  </span>
                  <button className="btn btn-ghost" disabled={page >= data.totalPages} onClick={() => update({ page: page + 1 })}>
                    Next
                  </button>
                </nav>
              )}
            </>
          )
        )}
      </div>
    </>
  );
}
