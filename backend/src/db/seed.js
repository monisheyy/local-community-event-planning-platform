/**
 * Seed demo data (users, events, registrations, comments).
 * Runs only when the users table is empty. Usage: npm run db:seed
 *
 * Demo accounts (password for all non-admin users: Password123)
 *   admin@community.local     / Admin@1234   (admin)
 *   priya@community.local     / Password123  (organizer)
 *   arjun@community.local     / Password123  (organizer)
 *   meera@community.local     / Password123  (participant)
 *   rahul@community.local     / Password123  (participant)
 *   divya@community.local     / Password123  (participant)
 */
import bcrypt from 'bcryptjs';
import { initDb, closeDb, getDb } from './index.js';
import { newId } from '../utils.js';

const DAY = 24 * 60 * 60 * 1000;

/** A date `days` from today at hh:mm India time (UTC+05:30), as a UTC ISO string. */
function at(days, hh, mm = 0) {
  const d = new Date(Date.now() + days * DAY);
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh, mm) - 330 * 60 * 1000;
  return new Date(utc).toISOString();
}
const hoursAfter = (iso, h) => new Date(new Date(iso).getTime() + h * 3600 * 1000).toISOString();

export async function seed({ force = false, quiet = false } = {}) {
  const db = getDb();
  const [{ n }] = await db.query('SELECT COUNT(*) AS n FROM users');
  if (Number(n) > 0 && !force) {
    if (!quiet) console.log('[seed] users already exist - skipping (run `npm run db:reset` to start fresh)');
    return false;
  }

  const created = new Date(Date.now() - 30 * DAY).toISOString();
  const pw = await bcrypt.hash('Password123', 10);
  const adminPw = await bcrypt.hash('Admin@1234', 10);

  const users = {
    admin: { name: 'Platform Admin', email: 'admin@community.local', role: 'admin', hash: adminPw, bio: 'Keeps the platform running smoothly.' },
    priya: { name: 'Priya Raman', email: 'priya@community.local', role: 'organizer', hash: pw, bio: 'Community volunteer and founder of the Besant Nagar Green Club.' },
    arjun: { name: 'Arjun Mehta', email: 'arjun@community.local', role: 'organizer', hash: pw, bio: 'Runs weekend coding meetups and sports leagues in Velachery.' },
    meera: { name: 'Meera Krishnan', email: 'meera@community.local', role: 'participant', hash: pw, bio: 'Loves music, books and long walks by the beach.' },
    rahul: { name: 'Rahul Varma', email: 'rahul@community.local', role: 'participant', hash: pw, bio: null },
    divya: { name: 'Divya Subramanian', email: 'divya@community.local', role: 'participant', hash: pw, bio: 'Final-year student, always up for volunteering.' },
  };
  for (const u of Object.values(users)) {
    u.id = newId();
    await db.execute(
      `INSERT INTO users (id, email, password_hash, name, role, bio, created_at)
       VALUES (@id, @email, @hash, @name, @role, @bio, @created)`,
      { ...u, created },
    );
  }

  const events = [
    { key: 'beach', org: 'priya', title: 'Besant Nagar Beach Clean-up Drive', category: 'Environment', location: "Elliot's Beach, Besant Nagar, Chennai", start: at(3, 6, 30), hours: 3, capacity: 80,
      description: 'Join neighbours for a morning beach clean-up. Gloves, bags and refreshments are provided. Wear comfortable clothes and bring a reusable water bottle. Certificates of participation for students.' },
    { key: 'code', org: 'arjun', title: 'Weekend Web Dev Meetup: React + Azure', category: 'Technology', location: 'Co-Work Hub, 2nd Floor, Velachery Main Road', start: at(5, 10, 0), hours: 4, capacity: 40,
      description: 'Hands-on session on building and deploying a React app to Azure App Service. Bring your laptop with Node.js installed. Beginners welcome - we will pair up newcomers with mentors.' },
    { key: 'yoga', org: 'priya', title: 'Sunrise Yoga in the Park', category: 'Health & Wellness', location: 'Nageswara Rao Park, Mylapore', start: at(2, 6, 0), hours: 1.5, capacity: 30,
      description: 'A gentle, all-levels yoga session led by a certified instructor. Please bring your own mat. Sessions run rain or shine under the pavilion.' },
    { key: 'cricket', org: 'arjun', title: 'Neighbourhood Cricket League - Round 1', category: 'Sports & Fitness', location: 'Corporation Ground, Adyar', start: at(9, 15, 30), hours: 4, capacity: 66,
      description: 'Six teams, tennis-ball cricket, 8 overs a side. Register individually and we will form balanced teams. Umpires, kits and water provided.' },
    { key: 'food', org: 'priya', title: 'Community Food Donation Drive', category: 'Volunteering', location: 'Community Hall, T. Nagar', start: at(7, 9, 0), hours: 5, capacity: 25,
      description: 'Help sort and pack dry rations for 200 families. Volunteers needed for packing, logistics and distribution. Lunch is on us!' },
    { key: 'music', org: 'arjun', title: 'Open Mic Evening: Music & Poetry', category: 'Music', location: 'The Brew Room, Besant Nagar', start: at(11, 18, 30), hours: 3, capacity: 50,
      description: 'An evening for local talent. Sign up to perform (5 minutes each) or simply come to listen. Acoustic instruments only; a keyboard and mic will be available.' },
    { key: 'art', org: 'priya', title: 'Kolam & Rangoli Workshop for Families', category: 'Arts & Culture', location: 'Kalakshetra Foundation Grounds, Thiruvanmiyur', start: at(14, 16, 0), hours: 2, capacity: 35,
      description: 'Learn traditional kolam patterns with expert artists. All materials provided. A fun session for children (8+) and parents together.' },
    { key: 'career', org: 'arjun', title: 'Career Guidance Talk for College Students', category: 'Education', location: 'Anna Centenary Library Auditorium, Kotturpuram', start: at(16, 11, 0), hours: 2, capacity: 120,
      description: 'Industry professionals share advice on internships, resumes and interviews in software, core engineering and design. Live Q&A at the end.' },
    { key: 'market', org: 'priya', title: 'Organic Farmers Market', category: 'Food & Drink', location: 'Ashok Nagar Community Grounds', start: at(20, 7, 0), hours: 5, capacity: 200,
      description: 'Fresh produce from local farms, millet snacks, cold-pressed oils and more. Bring your own bags - this is a plastic-free market.' },
    { key: 'tree', org: 'priya', title: 'Tree Plantation Sunday', category: 'Environment', location: 'Pallikaranai Marsh Entry Point', start: at(23, 7, 0), hours: 3, capacity: 60,
      description: 'Plant 500 native saplings with the forest department. Saplings and tools provided. Wear closed shoes.' },
    { key: 'pastrun', org: 'arjun', title: '5K Fun Run for Charity', category: 'Sports & Fitness', location: 'Marina Beach Promenade', start: at(-10, 5, 30), hours: 2, capacity: 150,
      description: 'A relaxed 5K run raising funds for the local children\'s library. Medals for every finisher.' },
    { key: 'pastmeet', org: 'priya', title: 'Residents Welfare Association Meeting', category: 'Community', location: 'Block C Clubhouse, Adyar', start: at(-4, 18, 0), hours: 1.5, capacity: 100,
      description: 'Monthly meeting to discuss water supply, street lighting and the upcoming festival celebrations.' },
  ];
  const eventIds = {};
  for (const e of events) {
    e.id = newId();
    eventIds[e.key] = e.id;
    await db.execute(
      `INSERT INTO events (id, organizer_id, title, description, category, location, start_time, end_time,
                           capacity, image_url, status, created_at, updated_at)
       VALUES (@id, @organizerId, @title, @description, @category, @location, @start, @end,
               @capacity, NULL, 'published', @created, @created)`,
      { ...e, organizerId: users[e.org].id, end: hoursAfter(e.start, e.hours), created },
    );
  }

  const regs = {
    beach: ['meera', 'rahul', 'divya', 'arjun'],
    code: ['meera', 'divya', 'rahul'],
    yoga: ['meera', 'divya'],
    cricket: ['rahul'],
    food: ['divya', 'meera'],
    music: ['meera'],
    career: ['divya', 'rahul'],
    pastrun: ['meera', 'rahul', 'divya'],
    pastmeet: ['rahul', 'meera'],
  };
  for (const [key, people] of Object.entries(regs)) {
    for (const p of people) {
      await db.execute(
        'INSERT INTO registrations (id, event_id, user_id, created_at) VALUES (@id, @eventId, @userId, @created)',
        { id: newId(), eventId: eventIds[key], userId: users[p].id, created },
      );
    }
  }

  const comments = [
    ['beach', 'meera', 'Is parking available near the beach entrance?', 2],
    ['beach', 'priya', 'Yes - there is free parking near the Ashtalakshmi temple side. See you all!', 1],
    ['code', 'divya', 'Will the session cover Azure SQL as well?', 1],
    ['code', 'arjun', 'Yes! We will connect the app to an Azure SQL database in the second half.', 0.5],
    ['yoga', 'rahul', 'Can complete beginners join?', 0.3],
  ];
  for (const [key, who, body, daysAgo] of comments) {
    await db.execute(
      'INSERT INTO comments (id, event_id, user_id, body, created_at) VALUES (@id, @eventId, @userId, @body, @created)',
      { id: newId(), eventId: eventIds[key], userId: users[who].id, body, created: new Date(Date.now() - daysAgo * DAY).toISOString() },
    );
  }

  const notes = [
    ['meera', 'beach', 'registration', 'You\'re registered for "Besant Nagar Beach Clean-up Drive". See you there!', 1],
    ['priya', 'beach', 'new_registration', 'Arjun Mehta registered for "Besant Nagar Beach Clean-up Drive".', 0.2],
    ['priya', 'beach', 'comment', 'Meera Krishnan commented on "Besant Nagar Beach Clean-up Drive".', 2],
    ['priya', 'food', 'new_registration', 'Divya Subramanian registered for "Community Food Donation Drive".', 3],
    ['arjun', 'code', 'comment', 'Divya Subramanian commented on "Weekend Web Dev Meetup: React + Azure".', 1],
  ];
  for (const [who, key, type, message, daysAgo] of notes) {
    await db.execute(
      `INSERT INTO notifications (id, user_id, event_id, type, message, is_read, created_at)
       VALUES (@id, @userId, @eventId, @type, @message, 0, @created)`,
      { id: newId(), userId: users[who].id, eventId: eventIds[key], type, message, created: new Date(Date.now() - daysAgo * DAY).toISOString() },
    );
  }

  console.log(`[seed] inserted ${Object.keys(users).length} users, ${events.length} events`);
  return true;
}

// Run directly: `node src/db/seed.js`
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed.js')) {
  await initDb();
  await seed({ force: process.argv.includes('--force') });
  await closeDb();
}
