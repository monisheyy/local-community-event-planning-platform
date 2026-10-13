import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError, nowIso } from '../utils.js';
import { saveImage, streamImage } from '../services/storage.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.storage.maxBytes, files: 1 } });

router.get('/health', async (_req, res) => {
  let database = 'ok';
  try {
    await getDb().query('SELECT 1 AS ok');
  } catch {
    database = 'unavailable';
  }
  res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok' ? 'ok' : 'degraded',
    database,
    databaseDriver: config.db.driver,
    storageDriver: config.storage.driver,
    time: nowIso(),
  });
});

router.get('/stats', async (_req, res) => {
  const [row] = await getDb().query(
    `SELECT
       (SELECT COUNT(*) FROM events WHERE status = 'published' AND end_time >= @now) AS upcoming_events,
       (SELECT COUNT(*) FROM users) AS members,
       (SELECT COUNT(*) FROM registrations) AS registrations`,
    { now: nowIso() },
  );
  res.json({
    upcomingEvents: Number(row.upcoming_events),
    members: Number(row.members),
    registrations: Number(row.registrations),
  });
});

/* ---------- comments (delete) ---------- */
router.delete('/comments/:id', requireAuth, async (req, res) => {
  const db = getDb();
  const [c] = await db.query(
    `SELECT c.id, c.user_id, e.organizer_id FROM comments c JOIN events e ON e.id = c.event_id WHERE c.id = @id`,
    { id: req.params.id },
  );
  if (!c) throw new HttpError(404, 'Comment not found');
  const allowed = req.user.role === 'admin' || req.user.id === c.user_id || req.user.id === c.organizer_id;
  if (!allowed) throw new HttpError(403, 'You cannot delete this comment.');
  await db.execute('DELETE FROM comments WHERE id = @id', { id: c.id });
  res.status(204).end();
});

/* ---------- notifications ---------- */
router.get('/notifications', requireAuth, async (req, res) => {
  const db = getDb();
  const rows = await db.query(
    db.paginate(
      `SELECT id, event_id, type, message, is_read, created_at FROM notifications
        WHERE user_id = @userId ORDER BY created_at DESC, id`,
    ),
    { userId: req.user.id, limit: 30, offset: 0 },
  );
  const [{ unread }] = await db.query(
    'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = @userId AND is_read = 0',
    { userId: req.user.id },
  );
  res.json({
    unread: Number(unread),
    notifications: rows.map((n) => ({
      id: n.id,
      eventId: n.event_id,
      type: n.type,
      message: n.message,
      read: Boolean(n.is_read),
      createdAt: n.created_at,
    })),
  });
});

router.post('/notifications/read-all', requireAuth, async (req, res) => {
  await getDb().execute('UPDATE notifications SET is_read = 1 WHERE user_id = @userId', { userId: req.user.id });
  res.json({ ok: true });
});

router.post('/notifications/:id/read', requireAuth, async (req, res) => {
  await getDb().execute('UPDATE notifications SET is_read = 1 WHERE id = @id AND user_id = @userId', {
    id: req.params.id,
    userId: req.user.id,
  });
  res.json({ ok: true });
});

/* ---------- file uploads (Azure Blob Storage / local) ---------- */
router.post('/uploads', requireAuth, requireRole('organizer', 'admin'), upload.single('image'), async (req, res) => {
  const url = await saveImage(req.file);
  res.status(201).json({ url });
});

router.get('/files/:name', async (req, res) => {
  await streamImage(req.params.name, res);
});

export default router;
