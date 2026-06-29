import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import InlineMessage from '../components/ui/InlineMessage';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Users, Calendar, CheckCircle2, QrCode } from 'lucide-react';

const VolunteerManagement = () => {
  const { user } = useAuth();
  const [volunteers, setVolunteers] = useState([]);
  const [games, setGames] = useState([]);
  const [venues, setVenues] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [profile, setProfile] = useState({ full_name: '', student_class: '', email: '', phone: '', role: 'volunteer' });
  const [shiftForm, setShiftForm] = useState({ volunteer_id: '', game_id: '', venue_id: '', shift_start: '', shift_end: '', duration_minutes: 120 });
  const [loadMessage, setLoadMessage] = useState({ type: '', text: '' });
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [shiftMsg, setShiftMsg] = useState({ type: '', text: '' });

  const load = async () => {
    try {
      const [volRes, shiftRes, gamesRes, venuesRes] = await Promise.all([
        api.get('/volunteers'),
        api.get('/volunteers/attendance'),
        api.get('/games'),
        api.get('/venues')
      ]);
      setVolunteers(volRes.data.volunteers || []);
      setShifts(shiftRes.data.attendance || []);
      setGames(gamesRes.data.games || []);
      setVenues(venuesRes.data.venues || []);
      setLoadMessage({ type: '', text: '' });
    } catch (err) {
      setLoadMessage({ type: 'danger', text: err.response?.data?.error || 'Unable to load volunteer data.' });
    }
  };

  useEffect(() => { load(); }, []);

  const createProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });
    try {
      await api.post('/volunteers', profile);
      setProfileMsg({ type: 'success', text: 'Volunteer profile saved.' });
      setProfile({ full_name: '', student_class: '', email: '', phone: '', role: 'volunteer' });
      load();
    } catch (err) {
      setProfileMsg({ type: 'danger', text: err.response?.data?.error || 'Could not save profile.' });
    }
  };

  const assignShift = async (e) => {
    e.preventDefault();
    setShiftMsg({ type: '', text: '' });
    try {
      await api.post('/volunteers/shifts', {
        ...shiftForm,
        game_id: shiftForm.game_id ? Number(shiftForm.game_id) : '',
        venue_id: shiftForm.venue_id ? Number(shiftForm.venue_id) : null
      });
      setShiftMsg({ type: 'success', text: 'Shift assigned and QR code generated.' });
      setShiftForm({ ...shiftForm, volunteer_id: '', game_id: '', venue_id: '', shift_start: '', shift_end: '' });
      load();
    } catch (err) {
      setShiftMsg({ type: 'danger', text: err.response?.data?.error || 'Could not assign shift.' });
    }
  };

  return (
    <Layout>
      <div className="oswms-container oswms-page">
        <PageHeader
          eyebrow="Volunteer Management"
          title="Volunteer tracking"
          subtitle="Register volunteers, assign game shifts, and capture attendance with QR-based checks."
          badge={<span className="badge bg-secondary">{user?.role === 'Major_Admin' ? 'Admin' : 'Committee'}</span>}
        />

        {loadMessage.text && <div className={`alert alert-${loadMessage.type}`}>{loadMessage.text}</div>}

        <div className="row g-4">
          <div className="col-lg-5">
            <div className="oswms-card p-4">
              <h2 className="h5 mb-3">Volunteer profile</h2>
              <form onSubmit={createProfile}>
                <div className="mb-3">
                  <label className="form-label">Full name</label>
                  <input className="form-control" required value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Student class</label>
                  <input className="form-control" value={profile.student_class} onChange={(e) => setProfile({ ...profile, student_class: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-oswms-primary w-100">Save volunteer</button>
                <InlineMessage message={profileMsg} />
              </form>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="oswms-card p-4">
              <h2 className="h5 mb-3">Attendance ledger</h2>
              <div className="table-responsive">
                <table className="table table-striped small mb-0">
                  <thead>
                    <tr>
                      <th>Volunteer</th>
                      <th>Game</th>
                      <th>Shift</th>
                      <th>Status</th>
                      <th>Scanned at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.length === 0 ? (
                      <tr><td colSpan="5" className="text-muted">No attendance recorded.</td></tr>
                    ) : (
                      shifts.map((row) => (
                        <tr key={row.id}>
                          <td>{row.volunteer_name}</td>
                          <td>{row.game_name || 'N/A'}</td>
                          <td>{row.shift_start ? new Date(row.shift_start).toLocaleString() : 'TBD'} – {row.shift_end ? new Date(row.shift_end).toLocaleString() : 'TBD'}</td>
                          <td>{row.attended ? 'Present' : 'Absent'}</td>
                          <td>{row.scanned_at ? new Date(row.scanned_at).toLocaleString() : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="oswms-card p-4 mt-4">
          <h2 className="h5 mb-3">Assign volunteer shift</h2>
          <form onSubmit={assignShift} className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Volunteer</label>
              <select className="form-select" required value={shiftForm.volunteer_id} onChange={(e) => setShiftForm({ ...shiftForm, volunteer_id: e.target.value })}>
                <option value="">Select volunteer</option>
                {volunteers.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.full_name || v.username || v.email || v.phone}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Game</label>
              <select className="form-select" required value={shiftForm.game_id} onChange={(e) => setShiftForm({ ...shiftForm, game_id: e.target.value })}>
                <option value="">Select game</option>
                {games.map((game) => <option key={game.id} value={game.id}>{game.name} ({game.sport_type})</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Venue</label>
              <select className="form-select" value={shiftForm.venue_id} onChange={(e) => setShiftForm({ ...shiftForm, venue_id: e.target.value })}>
                <option value="">Select venue (optional)</option>
                {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name} — {venue.location || 'No location'}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Shift start</label>
              <input type="datetime-local" className="form-control" required value={shiftForm.shift_start} onChange={(e) => setShiftForm({ ...shiftForm, shift_start: e.target.value })} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Shift end</label>
              <input type="datetime-local" className="form-control" required value={shiftForm.shift_end} onChange={(e) => setShiftForm({ ...shiftForm, shift_end: e.target.value })} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Duration</label>
              <input type="number" min="30" className="form-control" value={shiftForm.duration_minutes} onChange={(e) => setShiftForm({ ...shiftForm, duration_minutes: Number(e.target.value) })} />
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-oswms-primary d-flex align-items-center gap-2"><QrCode size={16} /> Assign shift</button>
              <InlineMessage message={shiftMsg} />
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default VolunteerManagement;
