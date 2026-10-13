# REST API reference

Base URL: `/api` (e.g. `https://<app>.azurewebsites.net/api`). All bodies are JSON unless noted.
Authenticated routes need the header `Authorization: Bearer <token>` (returned by register/login).
Errors always look like `{ "error": "Human readable message", "details": [{ "field": "...", "message": "..." }] }`.

| Role legend | |
| --- | --- |
| 🌐 | public |
| 👤 | any signed-in user |
| 🎤 | organizer or admin |
| 🛡️ | admin only |
| ✏️ | the event's organizer or an admin |

## Auth

| Method | Path | Access | Body / notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | 🌐 | `{ name, email, password, role: "participant" \| "organizer" }` → `201 { token, user }` |
| POST | `/auth/login` | 🌐 | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | 👤 | → `{ user }` |

## Events

| Method | Path | Access | Body / notes |
| --- | --- | --- | --- |
| GET | `/events` | 🌐 | Query: `q`, `category`, `when=upcoming\|past\|all`, `page`, `pageSize` (≤50) → `{ events, page, pageSize, total, totalPages }` |
| GET | `/events/categories` | 🌐 | → `{ categories }` |
| GET | `/events/:id` | 🌐 | → `{ event }` incl. `isRegistered`, `canManage` for the caller |
| POST | `/events` | 🎤 | `{ title, description, category, location, startTime, endTime, capacity, imageUrl? }` (ISO dates) → `201 { event }` |
| PUT | `/events/:id` | ✏️ | same body as POST; attendees are notified if time or location changes |
| POST | `/events/:id/cancel` | ✏️ | marks cancelled and notifies attendees |
| DELETE | `/events/:id` | ✏️ | deletes event, registrations, comments, notifications and image → `204` |

## Registrations & attendees

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/events/:id/register` | 👤 | `409` if already registered or full; `400` if cancelled/ended/own event |
| DELETE | `/events/:id/register` | 👤 | cancel own registration |
| GET | `/events/:id/attendees` | ✏️ | → `{ attendees: [{ id, name, email, registeredAt }] }` |
| GET | `/events/:id/attendees.csv` | ✏️ | CSV download (UTF-8 BOM, Excel friendly) |

## Comments

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/events/:id/comments` | 🌐 | newest first |
| POST | `/events/:id/comments` | 👤 | `{ body }` (1–1000 chars) |
| DELETE | `/comments/:id` | 👤 | author, event organizer or admin |

## Users

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| PUT | `/users/me` | 👤 | `{ name, bio? }` |
| PUT | `/users/me/password` | 👤 | `{ currentPassword, newPassword }` |
| GET | `/users/me/registrations` | 👤 | events I'm registered for |
| GET | `/users/me/events` | 🎤 | events I organise with `registration_count`, `comment_count` |
| GET | `/users` | 🛡️ | all users with activity counts |
| PATCH | `/users/:id/role` | 🛡️ | `{ role }` (cannot change own role) |

## Notifications

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/notifications` | 👤 | latest 30 + `unread` count |
| POST | `/notifications/:id/read` | 👤 | |
| POST | `/notifications/read-all` | 👤 | |

## Files, stats, health

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/uploads` | 🎤 | `multipart/form-data` field `image` (JPEG/PNG/WebP/GIF, ≤5 MB) → `201 { url }` |
| GET | `/files/:name` | 🌐 | streams an image from Blob Storage / local disk |
| GET | `/stats` | 🌐 | `{ upcomingEvents, members, registrations }` |
| GET | `/health` | 🌐 | `{ status, database, databaseDriver, storageDriver, time }`; `503` if DB is down |

## Example (curl)

```bash
TOKEN=$(curl -s -X POST localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"priya@community.local","password":"Password123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

curl -s -X POST localhost:4000/api/events -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{
  "title":"Chess in the Park","description":"Casual chess for all ages.","category":"Community",
  "location":"Nageswara Rao Park","startTime":"2026-12-01T12:30:00Z","endTime":"2026-12-01T14:30:00Z","capacity":20}'
```
