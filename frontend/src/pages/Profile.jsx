import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../toast.jsx';
import { Field, fieldErrors } from '../components/Common.jsx';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState({ name: user.name, bio: user.bio || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null);

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy('profile');
    setErrors({});
    try {
      const d = await api.put('/users/me', profile);
      setUser(d.user);
      toast('Profile saved.');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setBusy('pw');
    setErrors({});
    try {
      await api.put('/users/me/password', pw);
      setPw({ currentPassword: '', newPassword: '' });
      toast('Password changed.');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page narrow">
      <h1 className="page-title">Profile</h1>
      <p className="muted lead">
        Signed in as {user.email} <span className={`role role-${user.role}`}>{user.role}</span>
      </p>
      <form className="form card-surface" onSubmit={saveProfile}>
        <h2>About you</h2>
        <Field label="Full name" id="name" error={errors.name}>
          <input id="name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </Field>
        <Field label="Bio" id="bio" error={errors.bio} hint="Shown on events you organise. Up to 500 characters.">
          <textarea id="bio" rows={3} maxLength={500} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
        </Field>
        <div className="form-actions">
          <button className="btn btn-primary" disabled={busy === 'profile'}>
            Save profile
          </button>
        </div>
      </form>

      <form className="form card-surface" onSubmit={savePassword}>
        <h2>Change password</h2>
        <Field label="Current password" id="cur" error={errors.currentPassword}>
          <input id="cur" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
        </Field>
        <Field label="New password" id="new" error={errors.newPassword} hint="At least 8 characters, with a letter and a number.">
          <input id="new" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
        </Field>
        <div className="form-actions">
          <button className="btn btn-primary" disabled={busy === 'pw'}>
            Change password
          </button>
        </div>
      </form>
    </div>
  );
}
