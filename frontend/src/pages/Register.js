import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import InlineMessage from '../components/ui/InlineMessage';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const { isCommittee } = useAuth();
  const [games, setGames] = useState([]);
  const [tab, setTab] = useState('team');
  const [teamMsg, setTeamMsg] = useState({ type: '', text: '' });
  const [playerMsg, setPlayerMsg] = useState({ type: '', text: '' });
  const [teamForm, setTeamForm] = useState({ name: '', captain_name: '', captain_contact: '', game_id: '' });
  const [playerForm, setPlayerForm] = useState({ full_name: '', student_class: '', email: '', phone: '', game_id: '', team_id: '' });

  useEffect(() => {
    api.get('/games').then((res) => setGames(res.data.games || [])).catch(() => {});
  }, []);

  const submitTeam = async (e) => {
    e.preventDefault();
    setTeamMsg({ type: '', text: '' });
    try {
      await api.post('/teams', { ...teamForm, game_id: Number(teamForm.game_id) });
      setTeamMsg({ type: 'success', text: 'Team registered successfully!' });
      setTeamForm({ name: '', captain_name: '', captain_contact: '', game_id: '' });
    } catch (err) {
      setTeamMsg({ type: 'danger', text: err.response?.data?.error || 'Registration failed.' });
    }
  };

  const submitPlayer = async (e) => {
    e.preventDefault();
    setPlayerMsg({ type: '', text: '' });
    try {
      await api.post('/participants', {
        ...playerForm,
        game_id: Number(playerForm.game_id),
        team_id: playerForm.team_id ? Number(playerForm.team_id) : null
      });
      setPlayerMsg({ type: 'success', text: 'Participant registered successfully!' });
      setPlayerForm({ full_name: '', student_class: '', email: '', phone: '', game_id: '', team_id: '' });
    } catch (err) {
      setPlayerMsg({ type: 'danger', text: err.response?.data?.error || 'Registration failed.' });
    }
  };

  return (
    <Layout>
      <div className="container py-5" style={{ maxWidth: '640px' }}>
        <h1 className="mb-2">Registration</h1>
        <p className="text-muted mb-4">Register a team or individual participant for Sports Week.</p>

        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button type="button" className={`nav-link ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>Team</button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link ${tab === 'player' ? 'active' : ''}`} onClick={() => setTab('player')}>Participant</button>
          </li>
        </ul>
        {isCommittee && (
          <div className="alert alert-warning mb-4">Committee heads cannot register as participants or create/join teams.</div>
        )}

        {tab === 'team' ? (
          <form onSubmit={submitTeam} className="card shadow-sm border-0 p-4">
            <div className="mb-3">
              <label className="form-label">Game</label>
              <select className="form-select" required value={teamForm.game_id} onChange={(e) => setTeamForm({ ...teamForm, game_id: e.target.value })}>
                <option value="">Select game</option>
                {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Team name</label>
              <input className="form-control" required value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Captain name</label>
              <input className="form-control" required value={teamForm.captain_name} onChange={(e) => setTeamForm({ ...teamForm, captain_name: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Captain contact</label>
              <input className="form-control" value={teamForm.captain_contact} onChange={(e) => setTeamForm({ ...teamForm, captain_contact: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary w-100" disabled={isCommittee}>Register team</button>
            <InlineMessage message={teamMsg} />
          </form>
        ) : (
          <form onSubmit={submitPlayer} className="card shadow-sm border-0 p-4">
            <div className="mb-3">
              <label className="form-label">Game</label>
              <select className="form-select" required value={playerForm.game_id} onChange={(e) => setPlayerForm({ ...playerForm, game_id: e.target.value })}>
                <option value="">Select game</option>
                {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Full name</label>
              <input className="form-control" required value={playerForm.full_name} onChange={(e) => setPlayerForm({ ...playerForm, full_name: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Class</label>
              <input className="form-control" value={playerForm.student_class} onChange={(e) => setPlayerForm({ ...playerForm, student_class: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={playerForm.email} onChange={(e) => setPlayerForm({ ...playerForm, email: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Phone</label>
              <input className="form-control" value={playerForm.phone} onChange={(e) => setPlayerForm({ ...playerForm, phone: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Team ID (optional)</label>
              <input className="form-control" value={playerForm.team_id} onChange={(e) => setPlayerForm({ ...playerForm, team_id: e.target.value })} placeholder="If already assigned to a team" />
            </div>
            <button type="submit" className="btn btn-primary w-100" disabled={isCommittee}>Register participant</button>
            <InlineMessage message={playerMsg} />
          </form>
        )}
      </div>
    </Layout>
  );
};


export default Register;
