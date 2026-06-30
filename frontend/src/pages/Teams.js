import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import InlineMessage from '../components/ui/InlineMessage';
import { Plus, UserPlus } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';

const Teams = () => {
  const { isLoggedIn, isCommittee } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [gameId, setGameId] = useState('');
  const [tab, setTab] = useState('browse');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [createMsg, setCreateMsg] = useState({ type: '', text: '' });
  const [createForm, setCreateForm] = useState({ name: '', game_id: '' });
  const [joinMsg, setJoinMsg] = useState({});

  const loadTeams = () => {
    const url = gameId ? `/teams?game_id=${gameId}` : '/teams';
    api.get(url).then((r) => setTeams(r.data.teams || [])).catch(() => {});
  };

  useEffect(() => {
    api.get('/games').then((r) => setGames(r.data.games || [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadTeams();
  }, [gameId]);

  const createTeam = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) return navigate('/login');
    if (isCommittee) {
      setCreateMsg({ type: 'danger', text: 'Committee heads are not allowed to participate in games.' });
      return;
    }
    setMsg({ type: '', text: '' });
    try {
      await api.post('/teams', { ...createForm, game_id: Number(createForm.game_id) });
      setCreateMsg({ type: 'success', text: 'Team created and sent for committee-head review. You are captain and will be notified once it is accepted.' });
      setCreateForm({ name: '', game_id: '' });
      setTab('browse');
      loadTeams();
    } catch (err) {
      setCreateMsg({ type: 'danger', text: err.response?.data?.error || 'Failed.' });
    }
  };

  const requestJoin = async (teamId) => {
    if (!isLoggedIn) return navigate('/login');
    if (isCommittee) {
      setMsg({ type: 'danger', text: 'Committee heads are not allowed to participate in games.' });
      return;
    }
    const message = joinMsg[teamId] || '';
    setMsg({ type: '', text: '' });
    try {
      await api.post(`/teams/${teamId}/join`, { message });
      setMsg({ type: 'success', text: 'Join request sent. The captain will review it shortly.' });
    } catch (err) {
      setMsg({ type: 'danger', text: err.response?.data?.error || 'Request failed.' });
    }
  };

  return (
    <Layout>
      <div className="container py-4">
        <h1 className="oswms-page-title h3 mb-2">Teams</h1>
        <p className="text-muted mb-4">Create a team as captain, or request to join — the captain accepts or rejects join requests.</p>

        <InlineMessage message={msg} />
        <InlineMessage message={createMsg} />

        {!isLoggedIn && (
          <div className="alert alert-info">
            <Link to="/signup">Sign up</Link> or <Link to="/login">log in</Link> to create or join teams.
          </div>
        )}

        <ul className="nav nav-pills oswms-pills mb-4">
          <li className="nav-item">
            <button type="button" className={`nav-link ${tab === 'browse' ? 'active' : ''}`} onClick={() => setTab('browse')}>Browse teams</button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link ${tab === 'create' ? 'active' : ''} ${isCommittee ? 'disabled' : ''}`}
              onClick={() => !isCommittee && setTab('create')}
            >Create team</button>
          </li>
        </ul>
        {isCommittee && (
          <div className="alert alert-warning">Committee heads cannot participate in games or create/join teams.</div>
        )}

        <select className="form-select mb-4" style={{ maxWidth: 320 }} value={gameId} onChange={(e) => setGameId(e.target.value)}>
          <option value="">All games</option>
          {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        {tab === 'create' ? (
          <div className="oswms-card p-4" style={{ maxWidth: 480 }}>
            <h2 className="h5 mb-3 d-flex align-items-center gap-2"><Plus size={18} /> New team</h2>
            <InlineMessage message={createMsg} />
            <form onSubmit={createTeam}>
              <div className="mb-3">
                <label className="form-label">Game</label>
                <select className="form-select" required value={createForm.game_id} onChange={(e) => setCreateForm({ ...createForm, game_id: e.target.value })}>
                  <option value="">Select</option>
                  {games.filter((g) => g.status === 'active').map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Team name</label>
                <input className="form-control" required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-oswms-primary w-100" disabled={!isLoggedIn}>Create team (you become captain)</button>
            </form>
          </div>
        ) : (
          <div className="row g-3">
            {teams.filter((t) => t.verification_status !== 'rejected').map((t) => (
              <div key={t.id} className="col-md-6 col-lg-4">
                <div className="oswms-card p-4 h-100 d-flex flex-column">
                  <h3 className="h6 fw-bold">{t.name}</h3>
                  <p className="text-muted small mb-1">{t.game_name}</p>
                  <p className="small mb-2">Captain: {t.captain_name} · {t.member_count} members</p>
                  <p className="small text-muted mb-2">Status: {t.verification_status || 'open'}</p>
                  <input
                    className="form-control form-control-sm mb-2"
                    placeholder="Optional message to captain"
                    value={joinMsg[t.id] || ''}
                    onChange={(e) => setJoinMsg({ ...joinMsg, [t.id]: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary mt-auto d-flex align-items-center justify-content-center gap-1"
                    onClick={() => requestJoin(t.id)}
                    disabled={isCommittee}
                  >
                    <UserPlus size={14} /> Request to join
                  </button>
                </div>
              </div>
            ))}
            {teams.length === 0 && <p className="text-muted">No teams for this game yet.</p>}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Teams;
