import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import SectionCard from '../components/ui/SectionCard';
import LoadingScreen from '../components/ui/LoadingScreen';
import MatchStatusBadge from '../components/ui/MatchStatusBadge';
import { useAuth } from '../context/AuthContext';
import InlineMessage from '../components/ui/InlineMessage';
import { AlertTriangle, Calendar, Check, ClipboardList, RefreshCw, Trophy, Users, UserRound, X } from 'lucide-react';

const CommitteeDashboard = () => {
  const { logout, user } = useAuth();
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');
  const [rulesMsg, setRulesMsg] = useState(null);
  const [scoreMsg, setScoreMsg] = useState(null);
  const [scheduleMsg, setScheduleMsg] = useState(null);
  const [swapMsg, setSwapMsg] = useState(null);
  const [generateMsg, setGenerateMsg] = useState(null);
  const [verifyMsg, setVerifyMsg] = useState({ teamId: null, message: null });
  const [rulesText, setRulesText] = useState('');
  const [scoreForm, setScoreForm] = useState({ id: '', score_a: 0, score_b: 0, status: 'ongoing' });
  const [scoreConfirmation, setScoreConfirmation] = useState(null);
  const [scoreJustification, setScoreJustification] = useState('');
  const [scheduleForm, setScheduleForm] = useState({ matchId: '', scheduled_at: '', venue_id: '', duration_minutes: 90 });
  const [swapForm, setSwapForm] = useState({ matchId: '', replace_side: 'team_a', with_team_id: '' });
  const [assignmentForm, setAssignmentForm] = useState({ user_id: '', game_id: data?.game_id || '', role: 'Volunteer', role_type: 'Normal Helper', tier: 'standard' });
  const [assignments, setAssignments] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [assignmentMsg, setAssignmentMsg] = useState(null);
  const [attendanceMsg, setAttendanceMsg] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [editingAttendanceId, setEditingAttendanceId] = useState(null);
  const [playerTeamFilter, setPlayerTeamFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const [dashboardRes, assignmentsRes, studentsRes] = await Promise.all([
        api.get('/committee/dashboard'),
        api.get('/volunteers/assignments'),
        api.get('/committee/available-students')
      ]);
      setData(dashboardRes.data);
      setRulesText(dashboardRes.data.game?.rules_regulations || dashboardRes.data.game?.rules || '');
      setAssignments(assignmentsRes.data.assignments || []);
      setAvailableStudents(studentsRes.data.students || []);
      setAssignmentForm((prev) => ({ ...prev, game_id: dashboardRes.data.game_id || prev.game_id }));
    } catch (e) {
      setMsg(e.response?.data?.error || 'Could not load committee dashboard.');
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const saveRules = async (e) => {
    e.preventDefault();
    if (!data?.game_id) return;
    try {
      await api.put(`/games/${data.game_id}`, { rules_regulations: rulesText });
      setRulesMsg({ type: 'success', text: 'Rules & regulations saved.' });
      load();
    } catch (e) {
      setRulesMsg({ type: 'danger', text: e.response?.data?.error || 'Failed to save rules.' });
    }
  };

  const updateTeamVerificationStatus = (teamId, decision) => {
    setData((prev) => {
      if (!prev) return prev;
      const updatedTeams = prev.teams.map((team) => (team.id === teamId ? { ...team, verification_status: decision } : team));
      const teamToUpdate = prev.teams.find((team) => team.id === teamId);
      const updatedVerifiedTeams = decision === 'verified'
        ? [...(prev.verified_teams || []).filter((t) => t.id !== teamId), { ...(teamToUpdate || {}), verification_status: 'verified' }]
        : (prev.verified_teams || []).filter((t) => t.id !== teamId);
      const updatedStats = {
        ...prev.stats,
        teams_pending_verification: updatedTeams.filter((t) => ['pending_verification', 'open'].includes(t.verification_status)).length,
        teams_verified: updatedTeams.filter((t) => t.verification_status === 'verified').length,
        teams_total: updatedTeams.length
      };
      return {
        ...prev,
        teams: updatedTeams,
        verified_teams: updatedVerifiedTeams,
        stats: updatedStats
      };
    });
  };

  const verifyTeam = async (teamId, decision) => {
    try {
      await api.post(`/teams/${teamId}/verify`, { decision });
      setVerifyMsg({ teamId, message: { type: 'success', text: `Team marked ${decision}.` } });
      updateTeamVerificationStatus(teamId, decision);
      load();
    } catch (e) {
      setVerifyMsg({ teamId, message: { type: 'danger', text: e.response?.data?.error || 'Verification failed.' } });
    }
  };


  const publishScore = async (e) => {
    e.preventDefault();
    const selectedMatch = matches.find((match) => String(match.id) === String(scoreForm.id));
    const currentA = Number(selectedMatch?.score_a ?? 0);
    const currentB = Number(selectedMatch?.score_b ?? 0);
    const nextA = Number(scoreForm.score_a);
    const nextB = Number(scoreForm.score_b);
    const scoreDecreased = nextA < currentA || nextB < currentB;

    if (scoreDecreased && !scoreJustification.trim()) {
      setScoreMsg({ type: 'warning', text: 'Decreasing score requires a justification. Please provide a reason.' });
      return;
    }

    try {
      const res = await api.patch(`/matches/${scoreForm.id}/score`, {
        score_a: nextA,
        score_b: nextB,
        status: scoreForm.status,
        justification: scoreDecreased ? scoreJustification : null
      });
      const adv = res.data.bracket_advance?.advanced;
      setScoreMsg({ type: 'success', text: adv?.length ? `Score saved. Bracket advanced: ${adv.length} slot(s) filled.` : 'Score published.' });
      setScoreJustification('');
      setScoreConfirmation(null);
      load();
    } catch (e) {
      setScoreMsg({ type: 'danger', text: e.response?.data?.error || 'Score update failed.' });
    }
  };

  const updateSchedule = async (e) => {
    e.preventDefault();
    try {
      const res = await api.patch(`/matches/${scheduleForm.matchId}/schedule`, {
        scheduled_at: scheduleForm.scheduled_at || null,
        venue_id: scheduleForm.venue_id ? Number(scheduleForm.venue_id) : null,
        duration_minutes: Number(scheduleForm.duration_minutes),
        force: true
      });
      const n = res.data.conflicts?.length || 0;
      setScheduleMsg({ type: 'success', text: n ? `Schedule updated (${n} conflict warning(s)).` : 'Schedule updated.' });
      load();
    } catch (e) {
      setScheduleMsg({ type: 'danger', text: e.response?.data?.error || 'Schedule update failed.' });
    }
  };

  const swapOpponent = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/matches/${swapForm.matchId}/swap-opponents`, {
        mode: 'replace_opponent',
        replace_side: swapForm.replace_side,
        with_team_id: Number(swapForm.with_team_id)
      });
      const n = res.data.conflict_warnings?.length || 0;
      setSwapMsg({ type: 'success', text: n ? `Opponent swapped (${n} conflict warning(s)).` : 'Opponent swapped.' });
      load();
    } catch (e) {
      setSwapMsg({ type: 'danger', text: e.response?.data?.error || 'Swap failed.' });
    }
  };

  const flipSides = async (matchId) => {
    try {
      await api.post(`/matches/${matchId}/swap-opponents`, { mode: 'flip_sides' });
      setMsg('Home/away sides flipped.');
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || 'Flip failed.');
    }
  };

  const generateFixtures = async () => {
    try {
      const res = await api.post('/matches/generate-fixtures', {
        game_id: data.game_id,
        start_date: new Date().toISOString()
      });
      setGenerateMsg({ type: 'success', text: res.data.message });
      load();
    } catch (e) {
      setGenerateMsg({ type: 'danger', text: e.response?.data?.error || 'Fixture generation failed.' });
    }
  };

  const saveAssignment = async (e) => {
    e.preventDefault();
    try {
      await api.post('/volunteers/assign', {
        ...assignmentForm,
        game_id: Number(assignmentForm.game_id),
        user_id: Number(assignmentForm.user_id),
        role: 'Volunteer',
        role_type: assignmentForm.role_type || 'Normal Helper',
        tier: assignmentForm.tier || 'standard'
      });
      setAssignmentMsg({ type: 'success', text: 'Volunteer assignment saved.' });
      setAssignmentForm((prev) => ({ ...prev, user_id: '', role: 'Volunteer', role_type: '', tier: '' }));
      load();
    } catch (e) {
      setAssignmentMsg({ type: 'danger', text: e.response?.data?.error || 'Assignment failed.' });
    }
  };

  const markAttendance = async (assignmentId, attendanceStatus) => {
    if (!canEditAttendanceDate(attendanceDate)) {
      setAttendanceMsg({ type: 'warning', text: 'Attendance can only be updated for today.' });
      return;
    }

    try {
      await api.put(`/volunteers/assign/${assignmentId}`, {
        attendance_status: attendanceStatus,
        attendance_date: attendanceDate
      });
      setAttendanceMsg({ type: 'success', text: 'Attendance updated.' });
      setEditingAttendanceId(null);
      load();
    } catch (e) {
      setAttendanceMsg({ type: 'danger', text: e.response?.data?.error || 'Attendance update failed.' });
    }
  };

  const canEditAttendanceDate = (value) => {
    if (!value) return false;
    const selectedDate = new Date(`${value}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate.getTime() === today.getTime();
  };

  const isFutureAttendanceDate = (value) => {
    if (!value) return false;
    const selectedDate = new Date(`${value}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate.getTime() > today.getTime();
  };

  const getAttendanceDisplayStatus = (assignment) => {
    const statusValue = assignment.attendance_status;
    const normalized = statusValue === 1 || statusValue === 'present' ? 'present'
      : statusValue === 0 || statusValue === 'absent' ? 'absent'
      : 'pending';

    if (!attendanceDate) {
      return normalized;
    }

    const assignmentDate = assignment.attendance_date ? String(assignment.attendance_date).slice(0, 10) : null;
    if (assignmentDate && assignmentDate === attendanceDate) {
      return normalized;
    }

    return 'pending';
  };

  const getVerificationBadgeClass = (status) => {
    switch (status) {
      case 'verified': return 'bg-success';
      case 'rejected': return 'bg-danger';
      case 'pending_verification': return 'bg-warning text-dark';
      case 'open': return 'bg-info text-dark';
      default: return 'bg-secondary';
    }
  };

  const getVerificationLabel = (status) => {
    switch (status) {
      case 'verified': return 'Verified';
      case 'rejected': return 'Rejected';
      case 'pending_verification': return 'Pending verification';
      case 'open': return 'Open';
      default: return status || 'Unknown';
    }
  };

  const visibleAssignments = assignments.filter((assignment) => assignment.role !== 'Committee Head' && assignment.user_id !== user?.id);

  if (!data) {
    return (
      <Layout>
        <div className="oswms-container oswms-page">
          <LoadingScreen message={msg || 'Loading committee console…'} />
        </div>
      </Layout>
    );
  }

  const filteredTeamMembers = playerTeamFilter === 'all'
    ? data.team_members || []
    : (data.team_members || []).filter((member) => String(member.team_id) === String(playerTeamFilter));

  const {
    game,
    teams = [],
    team_members = [],
    matches = [],
    verified_teams = [],
    venues = [],
    conflicts = [],
    stats = {}
  } = data;
  const pendingTeams = teams.filter((t) => ['pending_verification', 'open'].includes(t.verification_status));

  return (
    <Layout>
      <div className="oswms-container oswms-page">
        <PageHeader
          eyebrow="Committee console"
          title={game.name}
          subtitle={`${game.sport_type} · ${user?.full_name} — rules, rosters, fixtures & live scores.`}
          actions={(
            <>
              <button type="button" className="btn btn-oswms-ghost btn-sm" onClick={load}>
                <RefreshCw size={14} className="me-1" /> Refresh
              </button>
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={logout}>Logout</button>
            </>
          )}
        />

        {msg && (
          <div className="oswms-alert-banner oswms-alert-banner--success mb-4 d-flex align-items-center gap-2">
            <span className="flex-grow-1">{msg}</span>
            <button type="button" className="btn-close" onClick={() => setMsg('')} aria-label="Close" />
          </div>
        )}

        <div className="row g-3 mb-4">
          <div className="col-6 col-lg-2"><StatCard label="Pending verification" value={stats.teams_pending_verification} icon={Trophy} warn /></div>
          <div className="col-6 col-lg-2"><StatCard label="Verified teams" value={stats.teams_verified} icon={Trophy} /></div>
          <div className="col-6 col-lg-2"><StatCard label="Teams" value={stats.teams_total} icon={Users} /></div>
          <div className="col-6 col-lg-2"><StatCard label="Team members" value={stats.team_members_total || 0} icon={UserRound} /></div>
          <div className="col-6 col-lg-2"><StatCard label="Join requests" value={stats.join_requests_pending || 0} icon={ClipboardList} warn /></div>
          <div className="col-6 col-lg-2"><StatCard label="Conflicts" value={stats.open_conflicts} icon={AlertTriangle} warn /></div>
        </div>
        <div className="row g-4">
          <div className="col-xl-5">
            <SectionCard title="Rules & regulations" icon={ClipboardList} className="mb-4">
              <form onSubmit={saveRules}>
                <textarea
                  className="form-control font-monospace small mb-2"
                  rows={8}
                  value={rulesText}
                  onChange={(e) => setRulesText(e.target.value)}
                />
                <button type="submit" className="btn btn-oswms-primary w-100">Save rules</button>
                <InlineMessage message={rulesMsg} />
              </form>
            </SectionCard>

            <SectionCard title="Team verification" icon={Trophy} className="mb-4">
              {pendingTeams.length === 0 ? (
                <p className="text-muted small mb-0">No teams awaiting review.</p>
              ) : (
                pendingTeams.map((t) => (
                  <div key={t.id} className="border-bottom py-3">
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div>
                        <strong>{t.name}</strong>
                        <div className="small text-muted">Captain: {t.captain_name} · {t.member_count} members</div>
                      </div>
                      <span className={`badge ${getVerificationBadgeClass(t.verification_status)}`}>{getVerificationLabel(t.verification_status)}</span>
                    </div>
                    <div className="mt-2 d-flex flex-wrap gap-2">
                      <button type="button" className="btn btn-sm btn-success" onClick={() => verifyTeam(t.id, 'verified')}>
                        <Check size={14} /> Accept
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => verifyTeam(t.id, 'rejected')}>
                        <X size={14} /> Reject
                      </button>
                    </div>
                    {verifyMsg.teamId === t.id && <div className="mt-2"><InlineMessage message={verifyMsg.message} /></div>}
                  </div>
                ))
              )}
            </SectionCard>

            <SectionCard title="Team tracking" icon={Users} className="mb-4">
              {teams.length === 0 ? (
                <p className="text-muted small mb-0">No teams have been registered yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>Captain</th>
                        <th>Members</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((team) => (
                        <React.Fragment key={team.id}>
                          <tr>
                            <td>{team.name}</td>
                            <td>{team.captain_name}</td>
                            <td>{team.member_count}</td>
                            <td><span className={`badge ${getVerificationBadgeClass(team.verification_status)}`}>{getVerificationLabel(team.verification_status)}</span></td>
                            <td className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
                                onClick={() => verifyTeam(team.id, 'verified')}
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => verifyTeam(team.id, 'rejected')}
                              >
                                Reject
                              </button>
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Player tracking" icon={UserRound} className="mb-4">
              {data.team_members?.length === 0 ? (
                <p className="text-muted small mb-0">No player assignments have been recorded yet.</p>
              ) : (
                <>
                  <div className="d-flex align-items-center justify-content-between mb-3 gap-2">
                    <div className="small text-muted">Showing {filteredTeamMembers.length} player(s)</div>
                    <div className="d-flex align-items-center gap-2">
                      <label className="form-label small mb-0">Filter by team</label>
                      <select className="form-select form-select-sm" value={playerTeamFilter} onChange={(e) => setPlayerTeamFilter(e.target.value)}>
                        <option value="all">All teams</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="table-responsive" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th>Team</th>
                          <th>Role</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTeamMembers.map((member) => (
                          <tr key={member.id}>
                            <td>{member.player_name}</td>
                            <td>{member.team_name}</td>
                            <td>{member.role}</td>
                            <td>
                              <span className={`badge ${member.status === 'accepted' ? 'bg-success' : member.status === 'pending' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                                {member.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </SectionCard>

            <SectionCard title="Schedule conflicts" icon={AlertTriangle}>
              {conflicts.length === 0 ? (
                <p className="text-muted small mb-0">No open player double-booking warnings.</p>
              ) : (
                conflicts.map((c) => (
                  <div key={c.id} className="border-bottom py-2 small">
                    <strong>{c.full_name}</strong> — {c.team_a_name} vs {c.team_b_name}
                  </div>
                ))
              )}
            </SectionCard>

            <SectionCard title="Assign student as volunteer" icon={ClipboardList} className="mb-4">
              <p className="small text-muted mb-3">Committee heads can only promote existing students to a volunteer role for this game.</p>
              <form onSubmit={saveAssignment} className="row g-2">
                <div className="col-12">
                  <label className="form-label small mb-1">Select student</label>
                  <select className="form-select" required value={assignmentForm.user_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, user_id: e.target.value })}>
                    <option value="">Select student</option>
                    {availableStudents.map((student) => (
                      <option key={student.id} value={student.id}>{student.full_name} ({student.username || student.email || 'student'})</option>
                    ))}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label small mb-1">Volunteer role</label>
                  <input className="form-control" value="Volunteer" readOnly />
                </div>
                <div className="col-12">
                  <label className="form-label small mb-1">Role type</label>
                  <input className="form-control" placeholder="e.g. Helper, Scorekeeper" value={assignmentForm.role_type} onChange={(e) => setAssignmentForm({ ...assignmentForm, role_type: e.target.value })} />
                </div>
                <div className="col-12">
                  <label className="form-label small mb-1">Tier</label>
                  <input className="form-control" placeholder="e.g. primary, backup" value={assignmentForm.tier} onChange={(e) => setAssignmentForm({ ...assignmentForm, tier: e.target.value })} />
                </div>
                <div className="col-12">
                  <button type="submit" className="btn btn-oswms-primary w-100">Save volunteer assignment</button>
                  <InlineMessage message={assignmentMsg} />
                </div>
              </form>
            </SectionCard>

            <SectionCard title="Attendance sheet" icon={Check} className="mb-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="small text-muted">
                  Present: {visibleAssignments.filter((a) => getAttendanceDisplayStatus(a) === 'present').length} · Absent: {visibleAssignments.filter((a) => getAttendanceDisplayStatus(a) === 'absent').length} · Pending: {visibleAssignments.filter((a) => getAttendanceDisplayStatus(a) === 'pending').length}
                </div>
                <div className="d-flex align-items-center gap-2">
                  <label className="form-label small mb-0">Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm w-auto"
                    value={attendanceDate}
                    onChange={(e) => {
                      setAttendanceDate(e.target.value);
                      setEditingAttendanceId(null);
                    }}
                  />
                </div>
              </div>
              {attendanceDate && !canEditAttendanceDate(attendanceDate) && (
                <p className="small text-muted mb-2">Past dates are read-only. Only today can be updated.</p>
              )}
              <InlineMessage message={attendanceMsg} />
              <div className="table-responsive">
                <table className="table table-sm small mb-0">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Role type</th>
                      <th>Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAssignments.length === 0 ? (
                      <tr><td colSpan="4" className="text-muted">No game assignments yet.</td></tr>
                    ) : visibleAssignments.map((assignment) => (
                      <tr key={assignment.id}>
                        <td>{assignment.full_name}</td>
                        <td>{assignment.role}</td>
                        <td>{assignment.role_type || '—'}</td>
                        <td>
                          <div className="d-flex gap-2 flex-wrap align-items-center">
                            <span className={`badge ${getAttendanceDisplayStatus(assignment) === 'present' ? 'bg-success' : getAttendanceDisplayStatus(assignment) === 'absent' ? 'bg-danger' : 'bg-secondary'}`}>
                              {getAttendanceDisplayStatus(assignment)}
                            </span>
                            {canEditAttendanceDate(attendanceDate) ? (
                              editingAttendanceId === assignment.id ? (
                                <>
                                  <button type="button" className="btn btn-sm btn-outline-success" onClick={() => markAttendance(assignment.id, 'present')}>Present</button>
                                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => markAttendance(assignment.id, 'absent')}>Absent</button>
                                  <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => setEditingAttendanceId(null)}>Cancel</button>
                                </>
                              ) : (
                                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setEditingAttendanceId(assignment.id)}>Edit</button>
                              )
                            ) : (
                              <span className="small text-muted">Read-only</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          <div className="col-xl-7">
            <SectionCard title="Live score (monotonic)" icon={Trophy} className="mb-4">
              <p className="small text-muted">Scores cannot decrease. Marking a match final advances the knockout bracket.</p>
              <form onSubmit={publishScore}>
                <select
                  className="form-select mb-2"
                  required
                  value={scoreForm.id}
                  onChange={(e) => {
                    const m = matches.find((x) => String(x.id) === e.target.value);
                    if (e.target.value && m && !window.confirm(`Confirm: Edit score for ${m.team_a_name || 'Team A'} vs ${m.team_b_name || 'Team B'}?`)) {
                      setScoreConfirmation(null);
                      return;
                    }
                    setScoreForm({
                      id: e.target.value,
                      score_a: m?.score_a ?? 0,
                      score_b: m?.score_b ?? 0,
                      status: m?.status === 'completed' ? 'completed' : 'ongoing'
                    });
                    setScoreConfirmation(e.target.value ? { match: m, id: e.target.value } : null);
                    setScoreJustification('');
                  }}
                >
                  <option value="">Select match</option>
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.team_a_name || 'TBD'} vs {m.team_b_name || 'TBD'} ({m.bracket_phase || 'league'})
                    </option>
                  ))}
                </select>
                <div className="row g-2 mb-2">
                  <div className="col">
                    <label className="form-label small mb-1">Score A</label>
                    <input type="number" min={0} className="form-control" value={scoreForm.score_a} onChange={(e) => setScoreForm({ ...scoreForm, score_a: e.target.value })} />
                  </div>
                  <div className="col">
                    <label className="form-label small mb-1">Score B</label>
                    <input type="number" min={0} className="form-control" value={scoreForm.score_b} onChange={(e) => setScoreForm({ ...scoreForm, score_b: e.target.value })} />
                  </div>
                </div>
                {scoreConfirmation && (Number(scoreForm.score_a) < Number(scoreConfirmation.match?.score_a ?? 0) || Number(scoreForm.score_b) < Number(scoreConfirmation.match?.score_b ?? 0)) && (
                  <div className="mb-2 p-2 border border-warning bg-warning-subtle rounded">
                    <label className="form-label small mb-1 d-block">⚠️ Score decreased — provide justification</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      placeholder="Explain why the score is being reduced (e.g., scoring error, match replay, etc.)"
                      value={scoreJustification}
                      onChange={(e) => setScoreJustification(e.target.value)}
                    />
                  </div>
                )}
                <select className="form-select mb-2" value={scoreForm.status} onChange={(e) => setScoreForm({ ...scoreForm, status: e.target.value })}>
                  <option value="ongoing">Live</option>
                  <option value="completed">Final — advances bracket</option>
                </select>
                <button type="submit" className="btn btn-danger w-100">Publish score</button>
                <InlineMessage message={scoreMsg} />
              </form>
            </SectionCard>

            <SectionCard title="Fixtures & scheduling" icon={Calendar} className="mb-4">
              <button type="button" className="btn btn-secondary w-100 mb-3" onClick={generateFixtures}>
                Generate fixtures (verified teams only)
              </button>
              <InlineMessage message={generateMsg} />
              <form onSubmit={updateSchedule} className="border-top pt-3 mb-3">
                <p className="small fw-semibold mb-2">Edit time / venue</p>
                <select className="form-select mb-2" required value={scheduleForm.matchId} onChange={(e) => setScheduleForm({ ...scheduleForm, matchId: e.target.value })}>
                  <option value="">Match</option>
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>{m.team_a_name || 'TBD'} vs {m.team_b_name || 'TBD'}</option>
                  ))}
                </select>
                <input type="datetime-local" className="form-control mb-2" value={scheduleForm.scheduled_at} onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_at: e.target.value })} />
                <select className="form-select mb-2" value={scheduleForm.venue_id} onChange={(e) => setScheduleForm({ ...scheduleForm, venue_id: e.target.value })}>
                  <option value="">Venue</option>
                  {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <input type="number" className="form-control mb-2" value={scheduleForm.duration_minutes} onChange={(e) => setScheduleForm({ ...scheduleForm, duration_minutes: e.target.value })} />
                <button type="submit" className="btn btn-outline-primary w-100">Update schedule</button>
                <InlineMessage message={scheduleMsg} />
              </form>
              <form onSubmit={swapOpponent} className="border-top pt-3">
                <p className="small fw-semibold mb-2">Swap opponent</p>
                <select className="form-select mb-2" required value={swapForm.matchId} onChange={(e) => setSwapForm({ ...swapForm, matchId: e.target.value })}>
                  <option value="">Match</option>
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>{m.team_a_name || 'TBD'} vs {m.team_b_name || 'TBD'}</option>
                  ))}
                </select>
                <select className="form-select mb-2" value={swapForm.replace_side} onChange={(e) => setSwapForm({ ...swapForm, replace_side: e.target.value })}>
                  <option value="team_a">Replace side A</option>
                  <option value="team_b">Replace side B</option>
                </select>
                <select className="form-select mb-2" required value={swapForm.with_team_id} onChange={(e) => setSwapForm({ ...swapForm, with_team_id: e.target.value })}>
                  <option value="">Verified team</option>
                  {verified_teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button type="submit" className="btn btn-warning w-100 mb-2">Replace opponent</button>
                <InlineMessage message={swapMsg} />
              </form>
              {swapForm.matchId && (
                <button type="button" className="btn btn-outline-secondary btn-sm w-100" onClick={() => flipSides(swapForm.matchId)}>
                  Flip A ↔ B on selected match
                </button>
              )}
            </SectionCard>
          </div>
        </div>

        <SectionCard title="Bracket & fixtures" icon={Calendar} className="mt-4">
          {matches.length === 0 ? (
            <p className="text-muted mb-0">No matches yet.</p>
          ) : (
            <div className="oswms-table-wrap">
              <table className="table oswms-table table-sm">
                <thead>
                  <tr>
                    <th>Phase</th>
                    <th>Fixture</th>
                    <th>When</th>
                    <th>Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.id}>
                      <td><span className="badge bg-secondary-subtle text-secondary">{m.bracket_phase || 'league'}</span></td>
                      <td>{m.team_a_name || 'TBD'} vs {m.team_b_name || 'TBD'}</td>
                      <td className="small">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : 'TBD'}</td>
                      <td className="fw-semibold">{m.score_a} – {m.score_b}</td>
                      <td><MatchStatusBadge status={m.status} live={m.status === 'ongoing'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </Layout>
  );
};

export default CommitteeDashboard;
