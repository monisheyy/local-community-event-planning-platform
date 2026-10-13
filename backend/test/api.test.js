/**
 * API integration tests - run with `npm test`.
 * Uses an in-memory SQLite database, so no Azure resources are needed.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-uploads-'));
delete process.env.AZURE_SQL_CONNECTION_STRING;
delete process.env.AZURE_SQL_SERVER;
delete process.env.AZURE_STORAGE_CONNECTION_STRING;

const { default: request } = await import('supertest');
const { initDb, closeDb } = await import('../src/db/index.js');
const { createApp } = await import('../src/app.js');

let app;
const inDays = (d, h = 0) => new Date(Date.now() + d * 86400000 + h * 3600000).toISOString();

async function signup(name, role = 'participant') {
  const email = `${name.toLowerCase()}@test.local`;
  const res = await request(app).post('/api/auth/register').send({ name, email, password: 'Password123', role });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { token: res.body.token, user: res.body.user, auth: { Authorization: `Bearer ${res.body.token}` } };
}

const eventPayload = (over = {}) => ({
  title: 'Park Clean-up',
  description: 'Help us clean the neighbourhood park.',
  category: 'Environment',
  location: 'Central Park, Chennai',
  startTime: inDays(2),
  endTime: inDays(2, 3),
  capacity: 2,
  ...over,
});

let organizer, alice, bob, carol, eventId;

before(async () => {
  await initDb({ driver: 'sqlite', sqliteFile: ':memory:' });
  app = createApp();
  organizer = await signup('Olivia', 'organizer');
  alice = await signup('Alice');
  bob = await signup('Bob');
  carol = await signup('Carol');
});

after(async () => {
  await closeDb();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

describe('authentication', () => {
  test('health check reports database ok', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.database, 'ok');
  });

  test('rejects weak passwords', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Weak', email: 'weak@test.local', password: 'short' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /at least 8/);
  });

  test('rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice Two', email: 'alice@test.local', password: 'Password123' });
    assert.equal(res.status, 409);
  });

  test('cannot self-register as admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Mallory', email: 'mallory@test.local', password: 'Password123', role: 'admin' });
    assert.equal(res.status, 400);
  });

  test('login works and never returns the password hash', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ALICE@test.local', password: 'Password123' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.password_hash, undefined);
  });

  test('wrong password gives a generic error', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@test.local', password: 'Wrong12345' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Incorrect email or password.');
  });

  test('/me requires a valid token', async () => {
    assert.equal((await request(app).get('/api/auth/me')).status, 401);
    assert.equal((await request(app).get('/api/auth/me').set('Authorization', 'Bearer nope')).status, 401);
    const ok = await request(app).get('/api/auth/me').set(alice.auth);
    assert.equal(ok.body.user.email, 'alice@test.local');
  });
});

describe('events', () => {
  test('participants cannot create events (RBAC)', async () => {
    const res = await request(app).post('/api/events').set(alice.auth).send(eventPayload());
    assert.equal(res.status, 403);
  });

  test('validates event input', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(organizer.auth)
      .send(eventPayload({ endTime: inDays(1) }));
    assert.equal(res.status, 400);
    assert.match(res.body.error, /End time/);
  });

  test('organizer creates an event', async () => {
    const res = await request(app).post('/api/events').set(organizer.auth).send(eventPayload());
    assert.equal(res.status, 201);
    assert.equal(res.body.event.organizer.name, 'Olivia');
    eventId = res.body.event.id;
  });

  test('event appears in public listing and search', async () => {
    const all = await request(app).get('/api/events');
    assert.equal(all.body.total, 1);
    const hit = await request(app).get('/api/events').query({ q: 'clean' });
    assert.equal(hit.body.events.length, 1);
    const miss = await request(app).get('/api/events').query({ q: 'cricket' });
    assert.equal(miss.body.events.length, 0);
    const cat = await request(app).get('/api/events').query({ category: 'Music' });
    assert.equal(cat.body.events.length, 0);
  });

  test('search treats SQL wildcards and quotes literally', async () => {
    const res = await request(app).get('/api/events').query({ q: "%' OR 1=1 --" });
    assert.equal(res.status, 200);
    assert.equal(res.body.events.length, 0);
  });

  test('other users cannot edit the event', async () => {
    const res = await request(app).put(`/api/events/${eventId}`).set(alice.auth).send(eventPayload({ title: 'Hacked' }));
    assert.equal(res.status, 403);
  });
});

describe('registrations & capacity', () => {
  test('participants can register', async () => {
    const res = await request(app).post(`/api/events/${eventId}/register`).set(alice.auth);
    assert.equal(res.status, 201);
    assert.equal(res.body.event.registrationCount, 1);
    assert.equal(res.body.event.isRegistered, true);
  });

  test('double registration is rejected', async () => {
    const res = await request(app).post(`/api/events/${eventId}/register`).set(alice.auth);
    assert.equal(res.status, 409);
  });

  test('capacity is enforced', async () => {
    assert.equal((await request(app).post(`/api/events/${eventId}/register`).set(bob.auth)).status, 201);
    const full = await request(app).post(`/api/events/${eventId}/register`).set(carol.auth);
    assert.equal(full.status, 409);
    assert.match(full.body.error, /full/);
  });

  test('capacity cannot be reduced below registrations', async () => {
    const res = await request(app).put(`/api/events/${eventId}`).set(organizer.auth).send(eventPayload({ capacity: 1 }));
    assert.equal(res.status, 400);
  });

  test('unregistering frees a seat', async () => {
    assert.equal((await request(app).delete(`/api/events/${eventId}/register`).set(bob.auth)).status, 200);
    assert.equal((await request(app).post(`/api/events/${eventId}/register`).set(carol.auth)).status, 201);
  });

  test('organizer sees attendees and CSV export; others cannot', async () => {
    const list = await request(app).get(`/api/events/${eventId}/attendees`).set(organizer.auth);
    assert.deepEqual(list.body.attendees.map((a) => a.name).sort(), ['Alice', 'Carol']);
    const csv = await request(app).get(`/api/events/${eventId}/attendees.csv`).set(organizer.auth);
    assert.match(csv.headers['content-type'], /text\/csv/);
    assert.match(csv.text, /alice@test.local/);
    assert.equal((await request(app).get(`/api/events/${eventId}/attendees`).set(alice.auth)).status, 403);
  });

  test('dashboards list registrations and organised events', async () => {
    const mine = await request(app).get('/api/users/me/registrations').set(alice.auth);
    assert.equal(mine.body.registrations.length, 1);
    const org = await request(app).get('/api/users/me/events').set(organizer.auth);
    assert.equal(org.body.events[0].registration_count, 2);
  });
});

describe('notifications, comments, updates', () => {
  test('registration creates notifications', async () => {
    const res = await request(app).get('/api/notifications').set(organizer.auth);
    assert.ok(res.body.unread >= 2);
    assert.ok(res.body.notifications.some((n) => n.type === 'new_registration'));
  });

  test('changing the time notifies attendees', async () => {
    const res = await request(app)
      .put(`/api/events/${eventId}`)
      .set(organizer.auth)
      .send(eventPayload({ startTime: inDays(3), endTime: inDays(3, 2) }));
    assert.equal(res.status, 200);
    const n = await request(app).get('/api/notifications').set(carol.auth);
    assert.ok(n.body.notifications.some((x) => x.type === 'event_updated'));
    await request(app).post('/api/notifications/read-all').set(carol.auth);
    assert.equal((await request(app).get('/api/notifications').set(carol.auth)).body.unread, 0);
  });

  test('comments: post, list, and delete permissions', async () => {
    const post = await request(app).post(`/api/events/${eventId}/comments`).set(alice.auth).send({ body: 'Looking forward!' });
    assert.equal(post.status, 201);
    const list = await request(app).get(`/api/events/${eventId}/comments`);
    assert.equal(list.body.comments[0].body, 'Looking forward!');
    assert.equal((await request(app).delete(`/api/comments/${post.body.comment.id}`).set(bob.auth)).status, 403);
    assert.equal((await request(app).delete(`/api/comments/${post.body.comment.id}`).set(organizer.auth)).status, 204);
  });

  test('empty comments are rejected', async () => {
    const res = await request(app).post(`/api/events/${eventId}/comments`).set(alice.auth).send({ body: '   ' });
    assert.equal(res.status, 400);
  });
});

describe('uploads', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  );

  test('organizer uploads an image and it can be fetched', async () => {
    const res = await request(app).post('/api/uploads').set(organizer.auth).attach('image', png, { filename: 'a.png', contentType: 'image/png' });
    assert.equal(res.status, 201);
    assert.match(res.body.url, /^\/api\/files\/.+\.png$/);
    const file = await request(app).get(res.body.url);
    assert.equal(file.status, 200);
    assert.equal(file.headers['content-type'], 'image/png');
  });

  test('rejects files that are not really images', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set(organizer.auth)
      .attach('image', Buffer.from('<script>alert(1)</script>'), { filename: 'x.png', contentType: 'image/png' });
    assert.equal(res.status, 400);
  });

  test('path traversal on file download is blocked', async () => {
    const res = await request(app).get('/api/files/..%2F..%2Fpackage.json');
    assert.equal(res.status, 404);
  });
});

describe('cancel & delete', () => {
  test('cancelling notifies attendees and blocks new registrations', async () => {
    assert.equal((await request(app).post(`/api/events/${eventId}/cancel`).set(organizer.auth)).status, 200);
    const n = await request(app).get('/api/notifications').set(alice.auth);
    assert.ok(n.body.notifications.some((x) => x.type === 'event_cancelled'));
    await request(app).delete(`/api/events/${eventId}/register`).set(carol.auth);
    assert.equal((await request(app).post(`/api/events/${eventId}/register`).set(bob.auth)).status, 400);
  });

  test('organizer deletes the event with all its data', async () => {
    assert.equal((await request(app).delete(`/api/events/${eventId}`).set(organizer.auth)).status, 204);
    assert.equal((await request(app).get(`/api/events/${eventId}`)).status, 404);
  });
});
