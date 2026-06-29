import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import SectionCard from '../components/ui/SectionCard';
import LoadingScreen from '../components/ui/LoadingScreen';
import MatchStatusBadge from '../components/ui/MatchStatusBadge';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Bell, Calendar, Trophy, Users, AlertTriangle, CheckCircle2, UserPlus } from 'lucide-react';

const statusBadge = (s) => {
  const map = {
    pending: 'oswms-badge-pending',
    accepted: 'oswms-badge-approved',
    rejected: 'oswms-badge-rejected'
  };
  return <span className={`badge ${map[s] || 'bg-secondary'}`}>{s}</span>;
};

const UserDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [captainRequests, setCaptainRequests] = useState([]);
  const [captainMembers, setCaptainMembers] = useState([]);
  const [acceptRole, setAcceptRole] = useState({});
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [editMessage, setEditMessage] = useState('');
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });
  const [liveScores, setLiveScores] = useState([]);
  const [lastPoll, setLastPoll] = useState(new Date().toISOString());

  const load = useCallback(async () => {
    try {
      const [res, cap, members] = await Promise.all([
        api.get('/user-dashboard'),
        api.get('/team-members/captain/pending').catch(() => ({ data: { requests: [] } })),
        api.get('/team-members/captain/members').catch(() => ({ data: { members: [] } }))
      ]);
      setData(res.data);
      setCaptainRequests(cap.data.requests || []);
      setCaptainMembers(members.data.members || []);
    } catch { /* ignore */ }
  }, []);

  const pollLive = useCallback(async () => {
    try {
      const res = await api.get(`/matches/live?since=${encodeURIComponent(lastPoll)}`);
      if (res.data.updates?.length) setLiveScores(res.data.updates);
      setLastPoll(res.data.server_time || new Date().toISOString());
    } catch { /* ignore */ }
  }, [lastPoll]);

  const acceptJoin = async (id) => {
    const role = typeof acceptRole[id] === 'string' && acceptRole[id].trim() ? acceptRole[id].trim() : 'player';
    try {
      await api.post(`/team-members/${id}/accept`, { role });
      setActionMsg({ type: 'success', text: 'Join request accepted.' });
      load();
    } catch (err) {
      setActionMsg({ type: 'danger', text: err.response?.data?.error || 'Failed to accept join request.' });
    }
  };
  const rejectJoin = async (id) => {
    try {
      await api.post(`/team-members/${id}/reject`, { reason: 'Not a fit for this roster.' });
      setActionMsg({ type: 'success', text: 'Join request rejected.' });
      load();
    } catch (err) {
      setActionMsg({ type: 'danger', text: err.response?.data?.error || 'Failed to reject join request.' });
    }
  };

  const saveEdit = async (id) => {
    try {
      await api.patch(`/team-members/${id}`, { request_message: editMessage });
      setActionMsg({ type: 'success', text: 'Request note updated.' });
      setEditingRequestId(null);
      setEditMessage('');
      load();
    } catch (err) {
      setActionMsg({ type: 'danger', text: err.response?.data?.error || 'Failed to update request note.' });
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => { load(); pollLive(); }, 8000);
    return () => clearInterval(t);
  }, [load, pollLive]);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    load();
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    load();
  };

  if (!data) {
    return (
      <Layout>
        <div className="oswms-container oswms-page">
          <LoadingScreen message="Loading your dashboard…" />
        </div>
      </Layout>
    );
  }

  const { memberships, matches, notifications, unread_count, conflicts, progress } = data;
  const hasLive = matches.some((m) => m.status === 'ongoing') || liveScores.some((m) => m.status === 'ongoing');

  return (
    <Layout>
      <div className="oswms-container oswms-page">
        <PageHeader
          eyebrow="Student hub"
          title={`Welcome, ${user?.full_name?.split(' ')[0] || 'Player'}`}
          subtitle="Your teams, fixtures, and live updates in one place."
          actions={<Link to="/teams" className="btn btn-oswms-primary">Join or create team</Link>}
        />

        {actionMsg.text && (
          <div className={`alert alert-${actionMsg.type === 'success' ? 'success' : 'danger'} mb-4`} role="alert">
            {actionMsg.text}
          </div>
        )}
        {captainRequests.length > 0 && (
          <div className="oswms-alert-banner oswms-alert-banner--info">
            <UserPlus size={22} className="flex-shrink-0" />
            <div className="flex-grow-1">
              <strong>Captain actions</strong>
              <p className="small mb-2">You have {captainRequests.length} pending join request(s).</p>
              {captainRequests.map((r) => (
                <div key={r.id} className="py-2 border-top border-primary border-opacity-25">
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <span><strong>{r.full_name}</strong> → {r.team_name}</span>
                    <div className="d-flex align-items-center gap-2">
                      <label className="form-label small mb-0">Role</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        style={{ width: 160 }}
                        value={acceptRole[r.id] ?? r.role ?? 'player'}
                        onChange={(e) => setAcceptRole((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="player"
                      />
                    </div>
                    <button type="button" className="btn btn-sm btn-success" onClick={() => acceptJoin(r.id)}>Accept</button>
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => rejectJoin(r.id)}>Reject</button>
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => { setEditingRequestId(r.id); setEditMessage(r.request_message || ''); }}>Edit</button>
                  </div>
                  {editingRequestId === r.id ? (
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <input className="form-control form-control-sm" style={{ maxWidth: 280 }} value={editMessage} onChange={(e) => setEditMessage(e.target.value)} placeholder="Edit request note" />
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => saveEdit(r.id)}>Save</button>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setEditingRequestId(null); setEditMessage(''); }}>Cancel</button>
                    </div>
                  ) : (
                    r.request_message && <div className="small text-muted">Note: {r.request_message}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {captainMembers.length > 0 && (
          <SectionCard title="Your team roster" icon={Users} className="mb-4">
            <div className="small text-muted mb-2">Track your team members and review history for join requests.</div>
            {captainMembers.map((member) => (
              <div key={member.id} className="oswms-list-item d-flex justify-content-between align-items-start gap-3">
                <div>
                  <strong>{member.full_name}</strong>
                  <div className="small text-muted">{member.team_name} · {member.game_name}</div>
                  <div className="small text-muted">{member.email || 'No email'}</div>
                </div>
                <div className="text-end">
                  {statusBadge(member.status)}
                  <div className="small text-muted mt-1">
                    {member.reviewed_at ? `Reviewed by ${member.reviewed_by_name || 'captain'} · ${new Date(member.reviewed_at).toLocaleDateString()}` : 'Awaiting captain review'}
                  </div>
                </div>
              </div>
            ))}
          </SectionCard>
        )}

        {conflicts?.length > 0 && (
          <div className="oswms-alert-banner oswms-alert-banner--warn">
            <AlertTriangle size={22} className="flex-shrink-0" />
            <div>
              <strong>Schedule conflict</strong>
              <p className="mb-0 small">You have overlapping match assignments. Contact the Major Admin or your game committee.</p>
            </div>
          </div>
        )}

        <div className="row g-3 mb-4">
          <div className="col-6 col-lg-3"><StatCard label="On teams" value={progress.accepted} icon={Users} /></div>
          <div className="col-6 col-lg-3"><StatCard label="Pending" value={progress.pending} icon={Bell} warn={progress.pending > 0} /></div>
          <div className="col-6 col-lg-3"><StatCard label="Upcoming" value={progress.upcoming_matches} icon={Calendar} /></div>
          <div className="col-6 col-lg-3"><StatCard label="Completed" value={progress.completed_matches} icon={Trophy} /></div>
        </div>

        <div className="row g-4">
          <div className="col-lg-7">
            <SectionCard
              title="My matches"
              icon={Calendar}
              className="mb-4"
              headerRight={hasLive ? <MatchStatusBadge live /> : null}
            >
              {matches.length === 0 ? (
                <p className="text-muted mb-0">No matches yet. Join a team with an accepted roster to see fixtures.</p>
              ) : (
                matches.map((m) => (
                  <div key={m.id} className={`oswms-list-item ${m.status === 'ongoing' ? 'oswms-match-live rounded px-2' : ''}`}>
                    <div className="d-flex justify-content-between flex-wrap gap-2">
                      <div>
                        <strong>{m.game_name}</strong>
                        <div className="text-muted small">{m.team_a_name} vs {m.team_b_name}</div>
                        <div className="small text-muted">{m.venue_name || 'Venue TBD'} · {m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : 'TBD'}</div>
                      </div>
                      <div className="text-end">
                        {(m.status === 'ongoing' || m.status === 'completed') && (
                          <div className="oswms-match-score mb-1">{m.score_a} – {m.score_b}</div>
                        )}
                        <MatchStatusBadge status={m.status} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </SectionCard>

            <SectionCard title="Team memberships" icon={Users}>
              {memberships.length === 0 ? (
                <p className="text-muted mb-0">You have not joined any team. <Link to="/teams">Browse teams</Link></p>
              ) : (
                memberships.map((m) => (
                  <div key={m.id} className="oswms-list-item d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{m.team_name}</strong>
                      <div className="small text-muted">{m.game_name}</div>
                      <div className="small text-muted">Team status: {m.verification_status || 'open'}</div>
                    </div>
                    {statusBadge(m.status)}
                  </div>
                ))
              )}
            </SectionCard>
          </div>

          <div className="col-lg-5">
            <SectionCard
              title="Notifications"
              icon={Bell}
              headerRight={(
                <>
                  {unread_count > 0 && <span className="badge bg-danger">{unread_count}</span>}
                  {unread_count > 0 && (
                    <button type="button" className="btn btn-sm btn-link" onClick={markAllRead}>Mark all read</button>
                  )}
                </>
              )}
            >
              {notifications.length === 0 ? (
                <p className="text-muted small mb-0">No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 mb-2 rounded ${!n.is_read ? 'oswms-notif-unread' : 'bg-light'}`}
                    role="button"
                    onClick={() => !n.is_read && markRead(n.id)}
                  >
                    <div className="d-flex justify-content-between">
                      <strong className="small">{n.title}</strong>
                      {!n.is_read && <CheckCircle2 size={14} className="text-primary" />}
                    </div>
                    <p className="small text-muted mb-1">{n.message}</p>
                    <span className="badge bg-secondary-subtle text-secondary">{n.type}</span>
                    <span className="small text-muted ms-2">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                ))
              )}
              <Link to="/announcements" className="btn btn-sm btn-outline-primary w-100 mt-2">Public announcements</Link>
            </SectionCard>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UserDashboard;
