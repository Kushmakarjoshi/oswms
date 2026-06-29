import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { Users, AlertTriangle, Trophy, Calendar, Bell, FileText } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import InlineMessage from '../components/ui/InlineMessage';

const AdminDashboard = () => {
  const { logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [matches, setMatches] = useState([]);
  const [games, setGames] = useState([]);
  const [msg, setMsg] = useState('');
  const [gameForm, setGameForm] = useState({ name: '', sport_type: '', format: 'round_robin', max_teams: 8, max_players_per_team: 15, status: 'active' });
  const [fixtureGameId, setFixtureGameId] = useState('');
  const [scoreMatch, setScoreMatch] = useState({ id: '', score_a: 0, score_b: 0, status: 'ongoing' });
  const [notifyForm, setNotifyForm] = useState({ title: '', message: '' });
  const [assignForm, setAssignForm] = useState({ user_id: '', game_id: '' });
  const [availableStudents, setAvailableStudents] = useState([]);
  const [assignableGames, setAssignableGames] = useState([]);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [createGameMsg, setCreateGameMsg] = useState(null);
  const [generateMsg, setGenerateMsg] = useState(null);
  const [scoreMsg, setScoreMsg] = useState(null);
  const [assignMsg, setAssignMsg] = useState(null);
  const [broadcastMsg, setBroadcastMsg] = useState(null);

  const load = useCallback(async () => {
    let hadError = false;

    try {
      const [s, c] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/matches/conflicts')
      ]);
      setStats(s.data.stats);
      setConflicts(c.data.conflicts || []);
    } catch (err) {
      hadError = true;
      setMsg(err.response?.data?.error || 'Could not load admin stats or conflict data.');
    }

    try {
      const [m, g] = await Promise.all([
        api.get('/matches'),
        api.get('/games')
      ]);
      setMatches(m.data.matches || []);
      setGames(g.data.games || []);
    } catch (err) {
      hadError = true;
      setMsg(err.response?.data?.error || 'Could not load match or game data.');
    }

    try {
      const [students, assignableGamesRes] = await Promise.all([
        api.get('/committee/available-students'),
        api.get('/committee/available-games')
      ]);
      setAvailableStudents(students.data.students || []);
      setAssignableGames(assignableGamesRes.data.games || []);
    } catch (err) {
      hadError = true;
      setMsg(err.response?.data?.error || 'Could not load committee assignment options.');
    }

    if (!hadError) {
      setMsg('');
    }
  }, []);

  const loadReport = useCallback(async () => {
    try {
      setReportLoading(true);
      const res = await api.get('/dashboard/report');
      setReport(res.data.report || null);
      setMsg('Executive report generated successfully.');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Could not generate report.');
    } finally {
      setReportLoading(false);
    }
  }, []);

  const downloadReport = () => {
    if (!report?.formattedOverview) return;
    const blob = new Blob([report.formattedOverview], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `oswms-admin-report-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    load();
    loadReport();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, [load, loadReport]);

  const resolveConflict = async (id) => {
    try {
      await api.post(`/matches/conflicts/${id}/resolve`, { resolution_note: 'Rescheduled by Major Admin.' });
      setMsg('Conflict marked resolved.');
      load();
    } catch {
      setMsg('Could not resolve conflict.');
    }
  };

  const createGame = async (e) => {
    e.preventDefault();
    try {
      await api.post('/games', { ...gameForm, status: 'active' });
      setCreateGameMsg({ type: 'success', text: 'Game created.' });
      load();
    } catch (e) {
      setCreateGameMsg({ type: 'danger', text: e.response?.data?.error || 'Failed.' });
    }
  };

  const generateFixtures = async () => {
    if (!fixtureGameId) return;
    try {
      const res = await api.post('/matches/generate-fixtures', { game_id: Number(fixtureGameId), start_date: new Date().toISOString() });
      setGenerateMsg({ type: 'success', text: res.data.message });
      load();
    } catch (e) {
      setGenerateMsg({ type: 'danger', text: e.response?.data?.error || 'Fixture generation failed.' });
    }
  };

  const selectMatchForScore = async (matchId) => {
    if (!matchId) {
      setScoreMatch({ id: '', score_a: 0, score_b: 0, status: 'ongoing' });
      return;
    }

    const selectedMatch = matches.find((match) => String(match.id) === String(matchId));
    if (selectedMatch) {
      setScoreMatch({
        id: String(selectedMatch.id),
        score_a: selectedMatch.score_a ?? 0,
        score_b: selectedMatch.score_b ?? 0,
        status: selectedMatch.status === 'completed' ? 'completed' : 'ongoing'
      });
    }

    try {
      const res = await api.get(`/matches/${matchId}`);
      const freshMatch = res.data.match;
      if (freshMatch) {
        setScoreMatch({
          id: String(freshMatch.id),
          score_a: freshMatch.score_a ?? 0,
          score_b: freshMatch.score_b ?? 0,
          status: freshMatch.status === 'completed' ? 'completed' : 'ongoing'
        });
      }
    } catch {
      // Keep the locally loaded values if the live fetch fails.
    }
  };

  const updateScore = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/matches/${scoreMatch.id}/score`, {
        score_a: Number(scoreMatch.score_a),
        score_b: Number(scoreMatch.score_b),
        status: scoreMatch.status
      });
      setScoreMsg({ type: 'success', text: 'Score published and notification sent to involved teams.' });
      load();
    } catch (e) {
      setScoreMsg({ type: 'danger', text: e.response?.data?.error || 'Score update failed.' });
    }
  };

  const assignCommittee = async (e) => {
    e.preventDefault();
    try {
      await api.post('/committee/assign', {
        user_id: Number(assignForm.user_id),
        game_id: Number(assignForm.game_id)
      });
      setAssignMsg({ type: 'success', text: 'Committee head assigned for the selected game.' });
      setAssignForm({ user_id: '', game_id: '' });
      await load();
    } catch (err) {
      setAssignMsg({ type: 'danger', text: err.response?.data?.error || 'Assignment failed.' });
    }
  };

  const broadcast = async (e) => {
    e.preventDefault();
    try {
      await api.post('/notifications/broadcast', notifyForm);
      setBroadcastMsg({ type: 'success', text: 'Public announcement published.' });
      setNotifyForm({ title: '', message: '' });
    } catch (e) {
      setBroadcastMsg({ type: 'danger', text: e.response?.data?.error || 'Broadcast failed.' });
    }
  };

  const statCards = stats ? [
    { label: 'Pending join requests', value: stats.pending_team_join_requests, icon: Users, warn: true },
    { label: 'Teams pending verification', value: stats.teams_pending_verification, icon: Users, warn: true },
    { label: 'Conflicts', value: stats.open_conflicts, icon: AlertTriangle, warn: true },
    { label: 'Games', value: stats.games, icon: Trophy },
    { label: 'Matches', value: stats.matches, icon: Calendar }
  ] : [];

  return (
    <Layout>
      <div className="oswms-container oswms-page">
        <PageHeader
          eyebrow="Major Admin"
          title="Control center"
          subtitle="Resolve conflicts, publish scores, assign committees. Captains handle join requests."
          actions={(
            <>
              <Link className="btn btn-oswms-primary btn-sm" to="/admin/tracking">Open tracking center</Link>
              <button type="button" className="btn btn-oswms-ghost btn-sm" onClick={load}>Refresh</button>
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={logout}>Logout</button>
            </>
          )}
        />

        {msg && (
          <div className="oswms-alert-banner oswms-alert-banner--info mb-4">
            {msg}
            <button type="button" className="btn-close ms-auto" onClick={() => setMsg('')} />
          </div>
        )}

        <div className="row g-3 mb-4">
          {statCards.map(({ label, value, icon: Icon, warn }) => (
            <div key={label} className="col-6 col-lg">
              <StatCard label={label} value={value} icon={Icon} warn={warn} />
            </div>
          ))}
        </div>
        <div className="row g-4">
          <div className="col-xl-4">
            <div className="oswms-card p-4 mb-4">
              <h2 className="h6 fw-bold mb-3 d-flex align-items-center gap-2"><Users size={16} /> Team join requests</h2>
              <p className="text-muted small mb-0">
                Captains accept or reject join requests from their student dashboard. Use the stat above for volume;
                open <Link to="/teams">Teams hub</Link> as a student account to act as captain.
              </p>
            </div>

            <div className="oswms-card p-4 mb-4">
              <h2 className="h6 fw-bold mb-3 d-flex align-items-center gap-2"><AlertTriangle size={16} /> Schedule conflicts</h2>
              {conflicts.length === 0 ? <p className="text-muted small mb-0">No open conflicts.</p> : (
                conflicts.map((c) => (
                  <div key={c.id} className="border-bottom py-2 small">
                    <strong>{c.full_name}</strong> — {c.game_name}<br />
                    <span className="text-danger">{c.team_a_name} vs {c.team_b_name}</span>
                    <button type="button" className="btn btn-sm btn-link" onClick={() => resolveConflict(c.id)}>Mark resolved</button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="col-xl-4">
            <div className="oswms-card p-4 mb-4">
              <h2 className="h6 fw-bold mb-3">Live score publish</h2>
              <form onSubmit={updateScore}>
                <select className="form-select mb-2" required value={scoreMatch.id} onChange={(e) => selectMatchForScore(e.target.value)}>
                  <option value="">Select match</option>
                  {matches.length === 0 ? (
                    <option value="" disabled>No matches available</option>
                  ) : matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.team_a_name || m.game_name || 'TBD'} vs {m.team_b_name || m.game_name || 'TBD'} ({m.status || 'unknown'})
                    </option>
                  ))}
                </select>
                <div className="row g-2 mb-2">
                  <div className="col"><input type="number" className="form-control" placeholder="Score A" value={scoreMatch.score_a} onChange={(e) => setScoreMatch({ ...scoreMatch, score_a: e.target.value })} /></div>
                  <div className="col"><input type="number" className="form-control" placeholder="Score B" value={scoreMatch.score_b} onChange={(e) => setScoreMatch({ ...scoreMatch, score_b: e.target.value })} /></div>
                </div>
                <select className="form-select mb-2" value={scoreMatch.status} onChange={(e) => setScoreMatch({ ...scoreMatch, status: e.target.value })}>
                  <option value="ongoing">Live (ongoing)</option>
                  <option value="completed">Final (completed)</option>
                </select>
                <p className="small text-muted mb-2">Selecting a match loads its current score and the update will notify involved teams.</p>
                <button type="submit" className="btn btn-danger w-100">Publish to players</button>
                <InlineMessage message={scoreMsg} />
              </form>
            </div>

            <div className="oswms-card p-4 mb-4">
              <h2 className="h6 fw-bold mb-3">Generate fixtures</h2>
              <select className="form-select mb-2" value={fixtureGameId} onChange={(e) => setFixtureGameId(e.target.value)}>
                <option value="">Game</option>
                {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button type="button" className="btn btn-secondary w-100" onClick={generateFixtures}>Generate (skips conflicts)</button>
              <InlineMessage message={generateMsg} />
            </div>

            <div className="oswms-card p-4 mb-4">
              <h2 className="h6 fw-bold mb-3">Create game</h2>
              <form onSubmit={createGame}>
                <input className="form-control mb-2" placeholder="Name" required value={gameForm.name} onChange={(e) => setGameForm({ ...gameForm, name: e.target.value })} />
                <input className="form-control mb-2" placeholder="Sport" required value={gameForm.sport_type} onChange={(e) => setGameForm({ ...gameForm, sport_type: e.target.value })} />
                <select className="form-select mb-2" value={gameForm.format} onChange={(e) => setGameForm({ ...gameForm, format: e.target.value })}>
                  <option value="round_robin">Round robin</option>
                  <option value="knockout">Knockout</option>
                </select>
                <select className="form-select mb-2" value={gameForm.status} onChange={(e) => setGameForm({ ...gameForm, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
                <label className="form-label small mb-1">Max teams</label>
                <input type="number" min="2" className="form-control mb-2" placeholder="8" value={gameForm.max_teams} onChange={(e) => setGameForm({ ...gameForm, max_teams: Number(e.target.value) })} />
                <label className="form-label small mb-1">Max players per team</label>
                <input type="number" min="1" className="form-control mb-2" placeholder="15" value={gameForm.max_players_per_team} onChange={(e) => setGameForm({ ...gameForm, max_players_per_team: Number(e.target.value) })} />
                <button type="submit" className="btn btn-oswms-primary w-100">Add game</button>
                <InlineMessage message={createGameMsg} />
              </form>
            </div>

            <div className="oswms-card p-4">
              <h2 className="h6 fw-bold mb-3 d-flex align-items-center gap-2"><FileText size={16} /> Professional admin report</h2>
              <p className="text-muted small">Generate a consolidated report covering games, committee members, teams, captains, rules, and complaints in a clear format.</p>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-dark flex-grow-1" onClick={loadReport} disabled={reportLoading}>
                  {reportLoading ? 'Generating…' : 'Generate full report'}
                </button>
                <button type="button" className="btn btn-oswms-primary" onClick={downloadReport} disabled={!report?.formattedOverview}>
                  Download
                </button>
              </div>
              {report && (
                <div className="mt-3 border rounded p-3 bg-light">
                  <div className="small fw-bold mb-2">Report preview</div>
                  <div className="small text-muted" style={{ whiteSpace: 'pre-wrap', maxHeight: '240px', overflowY: 'auto' }}>
                    {report.formattedOverview}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="col-xl-4">
            <div className="oswms-card p-4 mb-4">
              <h2 className="h6 fw-bold mb-3">Assign committee head</h2>
              <form onSubmit={assignCommittee}>
                <select className="form-select mb-2" required value={assignForm.user_id} onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })}>
                  <option value="">Select existing student</option>
                  {availableStudents.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.username} — {u.username} {u.student_class ? `(${u.student_class})` : ''} {u.email ? `• ${u.email}` : ''}
                    </option>
                  ))}
                </select>
                <select className="form-select mb-2" required value={assignForm.game_id} onChange={(e) => setAssignForm({ ...assignForm, game_id: e.target.value })}>
                  <option value="">Select game</option>
                  {assignableGames.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button type="submit" className="btn btn-outline-primary w-100">Assign committee head</button>
                <InlineMessage message={assignMsg} />
              </form>
              <p className="small text-muted mt-2 mb-0">Only existing students can be promoted to Committee Head for a specific game.</p>
            </div>

            <div className="oswms-card p-4">
              <h2 className="h6 fw-bold mb-3 d-flex align-items-center gap-2"><Bell size={16} /> Public announcement</h2>
              <form onSubmit={broadcast}>
                <input className="form-control mb-2" placeholder="Title" required value={notifyForm.title} onChange={(e) => setNotifyForm({ ...notifyForm, title: e.target.value })} />
                <textarea className="form-control mb-2" rows={3} placeholder="Message (visible without login)" required value={notifyForm.message} onChange={(e) => setNotifyForm({ ...notifyForm, message: e.target.value })} />
                <button type="submit" className="btn btn-oswms-primary w-100">Publish</button>
                <InlineMessage message={broadcastMsg} />
              </form>
              <Link to="/announcements" className="btn btn-sm btn-link mt-2 p-0">View public page</Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
