import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../toast.jsx';
import EventCover from '../components/EventCover.jsx';
import { ErrorNote, Field, Spinner, fieldErrors } from '../components/Common.jsx';
import { fromLocalInput, toLocalInput } from '../format.js';

const EMPTY = {
  title: '',
  description: '',
  category: 'Community',
  location: '',
  start: '',
  end: '',
  capacity: 50,
  imageUrl: null,
};

export default function EventForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef(null);

  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.get('/events/categories').then((d) => setCategories(d.categories));
    if (!editing) return;
    api
      .get(`/events/${id}`)
      .then(({ event }) => {
        if (!event.canManage) throw new Error('Only the organiser can edit this event.');
        setForm({
          title: event.title,
          description: event.description,
          category: event.category,
          location: event.location,
          start: toLocalInput(event.startTime),
          end: toLocalInput(event.endTime),
          capacity: event.capacity,
          imageUrl: event.imageUrl,
        });
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [editing, id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onStartChange = (e) => {
    const start = e.target.value;
    setForm((f) => {
      // Default the end time to two hours after the start
      if (start && (!f.end || f.end <= start)) {
        const d = new Date(start);
        d.setHours(d.getHours() + 2);
        return { ...f, start, end: toLocalInput(d.toISOString()) };
      }
      return { ...f, start };
    });
  };

  const upload = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('Image must be 5 MB or smaller.', 'error');
    const fd = new FormData();
    fd.append('image', file);
    setUploading(true);
    try {
      const d = await api.post('/uploads', fd);
      setForm((f) => ({ ...f, imageUrl: d.url }));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const local = {};
    if (!form.start) local.startTime = 'Choose a start date and time';
    if (!form.end) local.endTime = 'Choose an end date and time';
    if (Object.keys(local).length) return setErrors(local);

    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      location: form.location,
      startTime: fromLocalInput(form.start),
      endTime: fromLocalInput(form.end),
      capacity: Number(form.capacity),
      imageUrl: form.imageUrl,
    };
    setSaving(true);
    try {
      const d = editing ? await api.put(`/events/${id}`, payload) : await api.post('/events', payload);
      toast(editing ? 'Changes saved.' : 'Event published.');
      navigate(`/events/${d.event.id}`);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;
  if (editing && error && !form.title)
    return (
      <div className="page narrow">
        <ErrorNote error={error} />
      </div>
    );

  return (
    <div className="page narrow">
      <Link to={editing ? `/events/${id}` : '/'} className="back">
        {editing ? 'Back to event' : 'Back to events'}
      </Link>
      <h1 className="page-title">{editing ? 'Edit event' : 'Create an event'}</h1>
      <p className="muted lead">
        {editing ? 'Attendees are notified automatically if you change the time or place.' : 'It goes live as soon as you publish.'}
      </p>
      <ErrorNote error={error} />

      <form onSubmit={submit} className="form card-surface" noValidate>
        <div className="upload">
          <EventCover event={{ ...form, imageUrl: form.imageUrl }} size="form" />
          <div className="upload-actions">
            <input
              ref={fileRef}
              id="image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <label htmlFor="image" className="btn btn-ghost btn-sm">
              {uploading ? 'Uploading…' : form.imageUrl ? 'Replace image' : 'Add a cover image'}
            </label>
            {form.imageUrl && (
              <button type="button" className="link-btn" onClick={() => setForm((f) => ({ ...f, imageUrl: null }))}>
                Remove image
              </button>
            )}
            <small className="muted">JPEG, PNG, WebP or GIF up to 5 MB. Without one, a cover is made from the category.</small>
          </div>
        </div>

        <Field label="Event name" id="title" error={errors.title}>
          <input id="title" value={form.title} onChange={set('title')} maxLength={150} required placeholder="e.g. Sunday beach clean-up" />
        </Field>

        <div className="two-col">
          <Field label="Category" id="category" error={errors.category}>
            <select id="category" value={form.category} onChange={set('category')}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Number of spots" id="capacity" error={errors.capacity}>
            <input id="capacity" type="number" min={1} max={100000} value={form.capacity} onChange={set('capacity')} required />
          </Field>
        </div>

        <div className="two-col">
          <Field label="Starts" id="start" error={errors.startTime}>
            <input id="start" type="datetime-local" value={form.start} onChange={onStartChange} required />
          </Field>
          <Field label="Ends" id="end" error={errors.endTime}>
            <input id="end" type="datetime-local" value={form.end} min={form.start} onChange={set('end')} required />
          </Field>
        </div>

        <Field label="Location" id="location" error={errors.location} hint="Venue name and area, so people can find it on a map.">
          <input id="location" value={form.location} onChange={set('location')} maxLength={200} required placeholder="e.g. Nageswara Rao Park, Mylapore" />
        </Field>

        <Field label="Description" id="description" error={errors.description} hint="What will happen, what to bring, who it's for.">
          <textarea id="description" rows={7} value={form.description} onChange={set('description')} maxLength={5000} required />
        </Field>

        <div className="form-actions">
          <button className="btn btn-primary" disabled={saving || uploading}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Publish event'}
          </button>
          <Link to={editing ? `/events/${id}` : '/'} className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
