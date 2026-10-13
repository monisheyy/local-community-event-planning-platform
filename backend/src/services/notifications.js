/**
 * In-app notifications, stored in the `notifications` table and shown in the bell menu.
 * This is the single place where notifications are produced, so plugging in an external
 * channel (Azure Communication Services e-mail, Azure Notification Hubs push) only needs
 * a call added inside `notify()`.
 */
import { getDb } from '../db/index.js';
import { newId, nowIso } from '../utils.js';

export async function notify(userIds, { type, message, eventId = null }) {
  const db = getDb();
  const unique = [...new Set(userIds)].filter(Boolean);
  for (const userId of unique) {
    await db.execute(
      `INSERT INTO notifications (id, user_id, event_id, type, message, is_read, created_at)
       VALUES (@id, @userId, @eventId, @type, @message, 0, @now)`,
      { id: newId(), userId, eventId, type, message, now: nowIso() },
    );
  }
}

/** Notify every registered attendee of an event. */
export async function notifyAttendees(eventId, payload, exceptUserId) {
  const rows = await getDb().query('SELECT user_id FROM registrations WHERE event_id = @eventId', { eventId });
  await notify(
    rows.map((r) => r.user_id).filter((id) => id !== exceptUserId),
    { ...payload, eventId },
  );
}
