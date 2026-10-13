const LOCALE = 'en-IN';

export const fmtDay = (iso) => new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric' });
export const fmtMonth = (iso) => new Date(iso).toLocaleDateString(LOCALE, { month: 'short' });
export const fmtWeekday = (iso) => new Date(iso).toLocaleDateString(LOCALE, { weekday: 'short' });
export const fmtTime = (iso) => new Date(iso).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' });
export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtShortDate = (iso) =>
  new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });

export function fmtRange(startIso, endIso) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? `${fmtTime(startIso)} – ${fmtTime(endIso)}`
    : `${fmtTime(startIso)}, ${fmtShortDate(startIso)} – ${fmtTime(endIso)}, ${fmtShortDate(endIso)}`;
}

export function timeAgo(iso) {
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  const steps = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.35, 'week'],
    [12, 'month'],
    [Infinity, 'year'],
  ];
  let value = sec;
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return rtf.format(-Math.round(value), unit);
    value /= size;
  }
  return '';
}

/** ISO string -> value for <input type="datetime-local"> in the user's timezone */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : '');

export const isPast = (event) => new Date(event.endTime) < new Date();

export const seatsLeft = (event) => Math.max(0, event.capacity - event.registrationCount);
