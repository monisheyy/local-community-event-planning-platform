import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { HttpError } from '../utils.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: 'community-events-api',
  });
}

async function loadUser(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret, { issuer: 'community-events-api' });
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }
  // Re-read the user so role changes and deletions take effect immediately.
  const [user] = await getDb().query('SELECT id, email, name, role, bio, created_at FROM users WHERE id = @id', {
    id: payload.sub,
  });
  if (!user) throw new HttpError(401, 'Account no longer exists.');
  return user;
}

/** Attach req.user when a valid token is present, but allow anonymous access. */
export async function optionalAuth(req, _res, next) {
  req.user = await loadUser(req);
  next();
}

/** Require a signed-in user. */
export async function requireAuth(req, _res, next) {
  req.user = await loadUser(req);
  if (!req.user) throw new HttpError(401, 'Please sign in to continue.');
  next();
}

/** Role-based access control: requireRole('organizer', 'admin') */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) throw new HttpError(401, 'Please sign in to continue.');
    if (!roles.includes(req.user.role)) throw new HttpError(403, 'You do not have permission to do that.');
    next();
  };
}
