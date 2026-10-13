import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, newId, nowIso, publicUser } from '../utils.js';

const router = Router();

// Brute-force protection on credential endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(255),
  password: passwordSchema,
  // Admins cannot be self-registered; they are promoted by another admin.
  role: z.enum(['participant', 'organizer']).default('participant'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, password, role } = req.body;
  const db = getDb();
  const existing = await db.query('SELECT id FROM users WHERE email = @email', { email });
  if (existing.length) throw new HttpError(409, 'An account with this email already exists.');

  const user = {
    id: newId(),
    email,
    name,
    role,
    bio: null,
    created_at: nowIso(),
  };
  const passwordHash = await bcrypt.hash(password, 10);
  await db.execute(
    `INSERT INTO users (id, email, password_hash, name, role, bio, created_at)
     VALUES (@id, @email, @passwordHash, @name, @role, NULL, @createdAt)`,
    { id: user.id, email, passwordHash, name, role, createdAt: user.created_at },
  );
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const [user] = await getDb().query('SELECT * FROM users WHERE email = @email', { email });
  // Same message for unknown email and wrong password (avoids account enumeration)
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw new HttpError(401, 'Incorrect email or password.');
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
