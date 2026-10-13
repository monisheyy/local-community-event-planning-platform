import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { CATEGORIES, HttpError, newId, nowIso } from '../utils.js';
import { notify, notifyAttendees } from '../services/notifications.js';
import { deleteImage } from '../services/storage.js';

const router = Router();

/* ---------- helpers ---------- */

const toEvent = (r) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  category: r.category,
  location: r.location,
  startTime: r.start_time,
  endTime: r.end_time,
  capacity: r.capacity,
  imageUrl: r.image_url,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  registrationCount: Number(r.registration_count ?? 0),
  organizer: { id: r.organizer_id, name: r.organizer_name, bio: r.organizer_bio ?? null },
});

const EVENT_SELECT = `
  SELECT e.*, u.name AS organizer_name, u.bio AS organizer_bio,
         (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS registration_count
    FROM events e
    JOIN users u ON u.id = e.organizer_id`;

async function findEvent(id) {
  const [row] = await getDb().query(`${EVENT_SELECT} WHERE e.id = @id`, { id });
  if (!row) throw new HttpError(404, 'Event not found');
  return row;
}

const canManage = (user, eventRow) => user && (user.role === 'admin' || user.id === eventRow.organizer_id);

function assertCanManage(user, eventRow) {
  if (!canManage(user, eventRow)) throw new HttpError(403, 'Only the event organizer can do that.');
}

const escapeLike = (s) => s.replace(/[\\%_[]/g, (c) => `\\${c}`);

/* ---------- validation ---------- */

const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date and time')
  .transform((v) => new Date(v).toISOString());

const eventBody = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150, 'Title is too long'),
    description: z.string().trim().min(10, 'Description must be at least 10 characters').max(5000),
    category: z.enum(CATEGORIES, { message: 'Choose a valid category' }),
    location: z.string().trim().min(3, 'Location is required').max(200),
    startTime: isoDate,
    endTime: isoDate,
    capacity: z.coerce.number().int('Capacity must be a whole number').min(1, 'Capacity must be at least 1').max(100000),
    imageUrl: z
      .string()
      .regex(/^\/api\/files\/[0-9a-f-]{36}\.(jpg|png|gif|webp)$/, 'Invalid image reference')
      .nullable()
      .optional(),
  })
  .refine((v) => new Date(v.endTime) > new Date(v.startTime), {
    message: 'End time must be after the start time',
    path: ['endTime'],
  });

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  when: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

/* ---------- routes ---------- */

router.get('/categories', (_req, res) => res.json({ categories: CATEGORIES }));

router.get('/', validate(listQuery, 'query'), async (req, res) => {
  const { q, category, when, page, pageSize } = req.validQuery;
  const where = ["e.status = 'published'"];
  const params = { now: nowIso() };
  if (when === 'upcoming') where.push('e.end_time >= @now');
  if (when === 'past') where.push('e.end_time < @now');
  if (category) {
    where.push('e.category = @category');
    params.category = category;
  }
  if (q) {
    where.push("(e.title LIKE @q ESCAPE '\\' OR e.description LIKE @q ESCAPE '\\' OR e.location LIKE @q ESCAPE '\\')");
    params.q = `%${escapeLike(q)}%`;
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const order = when === 'past' ? 'e.start_time DESC' : 'e.start_time ASC';
  const db = getDb();

  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM events e ${whereSql}`, params);
  const rows = await db.query(db.paginate(`${EVENT_SELECT} ${whereSql} ORDER BY ${order}, e.id`), {
    ...params,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  res.json({
    events: rows.map(toEvent),
    page,
    pageSize,
    total: Number(total),
    totalPages: Math.max(1, Math.ceil(Number(total) / pageSize)),
  });
});

router.get('/:id', optionalAuth, async (req, res) => {
  const row = await findEvent(req.params.id);
  let isRegistered = false;
  if (req.user) {
    const reg = await getDb().query('SELECT id FROM registrations WHERE event_id = @eventId AND user_id = @userId', {
      eventId: row.id,
      userId: req.user.id,
    });
    isRegistered = reg.length > 0;
  }
  res.json({ event: { ...toEvent(row), isRegistered, canManage: Boolean(canManage(req.user, row)) } });
});

router.post('/', requireAuth, requireRole('organizer', 'admin'), validate(eventBody), async (req, res) => {
  const b = req.body;
  if (new Date(b.startTime) < new Date()) throw new HttpError(400, 'Start time must be in the future');
  const id = newId();
  const now = nowIso();
  await getDb().execute(
    `INSERT INTO events (id, organizer_id, title, description, category, location, start_time, end_time,
                         capacity, image_url, status, created_at, updated_at)
     VALUES (@id, @organizerId, @title, @description, @category, @location, @startTime, @endTime,
             @capacity, @imageUrl, 'published', @now, @now)`,
    { id, organizerId: req.user.id, ...b, imageUrl: b.imageUrl ?? null, now },
  );
  res.status(201).json({ event: toEvent(await findEvent(id)) });
});

router.put('/:id', requireAuth, validate(eventBody), async (req, res) => {
  const existing = await findEvent(req.params.id);
  assertCanManage(req.user, existing);
  const b = req.body;
  if (b.capacity < Number(existing.registration_count)) {
    throw new HttpError(400, `Capacity cannot be lower than the ${existing.registration_count} people already registered.`);
  }
  await getDb().execute(
    `UPDATE events SET title = @title, description = @description, category = @category, location = @location,
            start_time = @startTime, end_time = @endTime, capacity = @capacity, image_url = @imageUrl,
            updated_at = @now
      WHERE id = @id`,
    { id: existing.id, ...b, imageUrl: b.imageUrl ?? null, now: nowIso() },
  );
  if (existing.image_url && existing.image_url !== (b.imageUrl ?? null)) await deleteImage(existing.image_url);

  const changed = [];
  if (new Date(existing.start_time).getTime() !== new Date(b.startTime).getTime()) changed.push('time');
  if (existing.location !== b.location) changed.push('location');
  if (changed.length) {
    await notifyAttendees(
      existing.id,
      { type: 'event_updated', message: `"${b.title}" has a new ${changed.join(' and ')}. Please check the details.` },
      req.user.id,
    );
  }
  res.json({ event: toEvent(await findEvent(existing.id)) });
});

router.post('/:id/cancel', requireAuth, async (req, res) => {
  const existing = await findEvent(req.params.id);
  assertCanManage(req.user, existing);
  if (existing.status === 'cancelled') throw new HttpError(400, 'Event is already cancelled.');
  await getDb().execute("UPDATE events SET status = 'cancelled', updated_at = @now WHERE id = @id", {
    id: existing.id,
    now: nowIso(),
  });
  await notifyAttendees(existing.id, { type: 'event_cancelled', message: `"${existing.title}" has been cancelled by the organizer.` });
  res.json({ event: toEvent(await findEvent(existing.id)) });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const existing = await findEvent(req.params.id);
  assertCanManage(req.user, existing);
  const db = getDb();
  const attendees = await db.query('SELECT user_id FROM registrations WHERE event_id = @id', { id: existing.id });
  // Delete children first (no ON DELETE CASCADE - see schema notes)
  await db.execute('DELETE FROM notifications WHERE event_id = @id', { id: existing.id });
  await db.execute('DELETE FROM comments WHERE event_id = @id', { id: existing.id });
  await db.execute('DELETE FROM registrations WHERE event_id = @id', { id: existing.id });
  await db.execute('DELETE FROM events WHERE id = @id', { id: existing.id });
  await deleteImage(existing.image_url);
  if (existing.status !== 'cancelled') {
    await notify(
      attendees.map((a) => a.user_id),
      { type: 'event_cancelled', message: `"${existing.title}" was removed by the organizer.` },
    );
  }
  res.status(204).end();
});

/* ---------- registrations ---------- */

router.post('/:id/register', requireAuth, async (req, res) => {
  const event = await findEvent(req.params.id);
  if (event.status !== 'published') throw new HttpError(400, 'This event has been cancelled.');
  if (new Date(event.end_time) < new Date()) throw new HttpError(400, 'This event has already ended.');
  if (event.organizer_id === req.user.id) throw new HttpError(400, 'You are the organizer of this event.');

  const db = getDb();
  const existing = await db.query('SELECT id FROM registrations WHERE event_id = @eventId AND user_id = @userId', {
    eventId: event.id,
    userId: req.user.id,
  });
  if (existing.length) throw new HttpError(409, 'You are already registered for this event.');

  // Atomic capacity check: the row is only inserted while seats remain.
  const { rowsAffected } = await db.execute(
    `INSERT INTO registrations (id, event_id, user_id, created_at)
     SELECT @id, @eventId, @userId, @now
      WHERE (SELECT COUNT(*) FROM registrations WHERE event_id = @eventId) < @capacity`,
    { id: newId(), eventId: event.id, userId: req.user.id, now: nowIso(), capacity: event.capacity },
  );
  if (!rowsAffected) throw new HttpError(409, 'Sorry, this event is full.');

  await notify([req.user.id], {
    type: 'registration',
    message: `You're registered for "${event.title}". See you there!`,
    eventId: event.id,
  });
  await notify([event.organizer_id], {
    type: 'new_registration',
    message: `${req.user.name} registered for "${event.title}".`,
    eventId: event.id,
  });
  res.status(201).json({ event: { ...toEvent(await findEvent(event.id)), isRegistered: true } });
});

router.delete('/:id/register', requireAuth, async (req, res) => {
  const event = await findEvent(req.params.id);
  const { rowsAffected } = await getDb().execute(
    'DELETE FROM registrations WHERE event_id = @eventId AND user_id = @userId',
    { eventId: event.id, userId: req.user.id },
  );
  if (!rowsAffected) throw new HttpError(404, 'You are not registered for this event.');
  res.json({ event: { ...toEvent(await findEvent(event.id)), isRegistered: false } });
});

async function attendeeRows(eventId) {
  return getDb().query(
    `SELECT u.id, u.name, u.email, r.created_at AS registered_at
       FROM registrations r JOIN users u ON u.id = r.user_id
      WHERE r.event_id = @eventId
      ORDER BY r.created_at ASC`,
    { eventId },
  );
}

router.get('/:id/attendees', requireAuth, async (req, res) => {
  const event = await findEvent(req.params.id);
  assertCanManage(req.user, event);
  const rows = await attendeeRows(event.id);
  res.json({
    attendees: rows.map((r) => ({ id: r.id, name: r.name, email: r.email, registeredAt: r.registered_at })),
  });
});

router.get('/:id/attendees.csv', requireAuth, async (req, res) => {
  const event = await findEvent(req.params.id);
  assertCanManage(req.user, event);
  const rows = await attendeeRows(event.id);
  // Quote every cell and neutralise spreadsheet formulas (CSV injection)
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [
    ['#', 'Name', 'Email', 'Registered at (UTC)'].map(cell).join(','),
    ...rows.map((r, i) => [i + 1, r.name, r.email, r.registered_at].map(cell).join(',')),
  ].join('\r\n');
  const fileName = event.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'event';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}-attendees.csv"`);
  res.send(`﻿${csv}`);
});

/* ---------- comments ---------- */

router.get('/:id/comments', async (req, res) => {
  await findEvent(req.params.id);
  const rows = await getDb().query(
    `SELECT c.id, c.body, c.created_at, c.user_id, u.name AS user_name, u.role AS user_role
       FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.event_id = @eventId
      ORDER BY c.created_at DESC`,
    { eventId: req.params.id },
  );
  res.json({
    comments: rows.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.created_at,
      author: { id: c.user_id, name: c.user_name, role: c.user_role },
    })),
  });
});

const commentBody = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(1000, 'Comment must be 1000 characters or fewer'),
});

router.post('/:id/comments', requireAuth, validate(commentBody), async (req, res) => {
  const event = await findEvent(req.params.id);
  const comment = { id: newId(), createdAt: nowIso() };
  await getDb().execute(
    `INSERT INTO comments (id, event_id, user_id, body, created_at)
     VALUES (@id, @eventId, @userId, @body, @createdAt)`,
    { ...comment, eventId: event.id, userId: req.user.id, body: req.body.body },
  );
  if (event.organizer_id !== req.user.id) {
    await notify([event.organizer_id], {
      type: 'comment',
      message: `${req.user.name} commented on "${event.title}".`,
      eventId: event.id,
    });
  }
  res.status(201).json({
    comment: {
      ...comment,
      body: req.body.body,
      author: { id: req.user.id, name: req.user.name, role: req.user.role },
    },
  });
});

export default router;
