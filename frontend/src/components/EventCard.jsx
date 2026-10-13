import { Link } from 'react-router-dom';
import EventCover from './EventCover.jsx';
import { fmtDay, fmtMonth, fmtTime, fmtWeekday, isPast, seatsLeft } from '../format.js';

export default function EventCard({ event }) {
  const left = seatsLeft(event);
  const past = isPast(event);
  const fill = Math.min(100, Math.round((event.registrationCount / event.capacity) * 100));
  return (
    <article className="event-card">
      <Link to={`/events/${event.id}`} className="event-card-link">
        <div className="event-card-media">
          <EventCover event={event} />
          <div className="date-badge" aria-label={new Date(event.startTime).toDateString()}>
            <span className="date-badge-month">{fmtMonth(event.startTime)}</span>
            <span className="date-badge-day">{fmtDay(event.startTime)}</span>
          </div>
          {event.status === 'cancelled' && <span className="pill pill-danger cover-pill">Cancelled</span>}
        </div>
        <div className="event-card-body">
          <p className="event-card-cat">{event.category}</p>
          <h3 className="event-card-title">{event.title}</h3>
          <p className="event-card-meta">
            {fmtWeekday(event.startTime)}, {fmtTime(event.startTime)}
          </p>
          <p className="event-card-meta muted">{event.location}</p>
        </div>
      </Link>
      <div className="event-card-foot">
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${fill}%` }} />
        </div>
        <span className={left === 0 && !past ? 'text-danger' : 'muted'}>
          {past ? `${event.registrationCount} attended` : left === 0 ? 'Full' : `${left} of ${event.capacity} spots left`}
        </span>
      </div>
    </article>
  );
}
