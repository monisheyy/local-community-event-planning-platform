import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, publicUser } from '../utils.js';
import { passwordSchema } from './auth.js';
import { notify } from '../services/notifications.js';

const router = Router();

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  bio: z.string().trim().max(500, 'Bio must be 500 characters or fewer').optional().nullable(),
});

router.put('/me', requireAuth, validate(profileSchema), async (req, res) => {
  const { name, bio } = req.body;
  await getDb().execute('UPDATE users SET name = @name, bio = @bio WHERE id = @id', {
    id: req.user.id,
    name,
    bio: bio || null,
  });
  res.json({ user: publicUser({ ...req.user, name, bio: bio || null }) });
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

router.put('/me/password', requireAuth, validate(passwordChangeSchema), async (req, res) => {
  const db = getDb();
  const [row] = await db.query('SELECT password_hash FROM users WHERE id = @id', { id: req.user.id });
  if (!(await bcrypt.compare(req.body.currentPassword, row.password_hash))) {
    throw new HttpError(400, 'Current password is incorrect.');
  }
  const passwordHash = await bcrypt.hash(req.body.newPassword, 10);
  await db.execute('UPDATE users SET password_hash = @passwordHash WHERE id = @id', { id: req.user.id, passwordHash });
  res.json({ ok: true });
});

/** Participant view: events I'm registered for. */
router.get('/me/registrations', requireAuth, async (req, res) => {
  const rows = await getDb().query(
    `SELECT e.id, e.title, e.category, e.location, e.start_time, e.end_time, e.image_url, e.status,
            r.created_at AS registered_at, u.name AS organizer_name
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       JOIN users u ON u.id = e.organizer_id
      WHERE r.user_id = @userId
      ORDER BY e.start_time ASC`,
    { userId: req.user.id },
  );
  res.json({ registrations: rows });
});

/** Organizer view: events I organise, with registration numbers. */
router.get('/me/events', requireAuth, requireRole('organizer', 'admin'), async (req, res) => {
  const rows = await getDb().query(
    `SELECT e.id, e.title, e.category, e.location, e.start_time, e.end_time, e.capacity, e.image_url, e.status,
            (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS registration_count,
            (SELECT COUNT(*) FROM comments c WHERE c.event_id = e.id) AS comment_count
       FROM events e
      WHERE e.organizer_id = @userId
      ORDER BY e.start_time DESC`,
    { userId: req.user.id },
  );
  res.json({ events: rows });
});

/* ---------- Admin ---------- */

router.get('/', requireAuth, requireRole('admin'), async (_req, res) => {
  const rows = await getDb().query(
    `SELECT u.id, u.email, u.name, u.role, u.bio, u.created_at,
            (SELECT COUNT(*) FROM events e WHERE e.organizer_id = u.id) AS event_count,
            (SELECT COUNT(*) FROM registrations r WHERE r.user_id = u.id) AS registration_count
       FROM users u
      ORDER BY u.created_at DESC`,
  );
  res.json({
    users: rows.map((u) => ({ ...publicUser(u), eventCount: u.event_count, registrationCount: u.registration_count })),
  });
});

const roleSchema = z.object({ role: z.enum(['participant', 'organizer', 'admin']) });

router.patch('/:id/role', requireAuth, requireRole('admin'), validate(roleSchema), async (req, res) => {
  if (req.params.id === req.user.id) throw new HttpError(400, 'You cannot change your own role.');
  const db = getDb();
  const { rowsAffected } = await db.execute('UPDATE users SET role = @role WHERE id = @id', {
    id: req.params.id,
    role: req.body.role,
  });
  if (!rowsAffected) throw new HttpError(404, 'User not found');
  await notify([req.params.id], { type: 'role', message: `Your account role was changed to ${req.body.role}.` });
  res.json({ ok: true });
});

export default router;
