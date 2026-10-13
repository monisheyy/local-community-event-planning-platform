import { randomUUID } from 'node:crypto';

export const newId = () => randomUUID();
export const nowIso = () => new Date().toISOString();

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const CATEGORIES = [
  'Community',
  'Sports & Fitness',
  'Education',
  'Arts & Culture',
  'Health & Wellness',
  'Volunteering',
  'Environment',
  'Technology',
  'Food & Drink',
  'Music',
];

/** Strip the password hash before sending a user to the client. */
export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role, bio: u.bio ?? null, createdAt: u.created_at };
}
