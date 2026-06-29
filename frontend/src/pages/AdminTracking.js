import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Calendar, Filter, Search, ShieldCheck, Trophy, Users, UserRound, ListChecks, FileText } from 'lucide-react';
import api from '../services/api';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';

const sectionButtons = [
  { key: 'overview', label: 'Overview', icon: ListChecks },
  { key: 'students', label: 'Students', icon: Users },
  { key: 'committees', label: 'Committees', icon: ShieldCheck },
  { key: 'games', label: 'Games', icon: Trophy },
  { key: 'volunteers', label: 'Volunteers', icon: UserRound },
  { key: 'participants', label: 'Participants', icon: UserRound },
  { key: 'teams', label: 'Teams', icon: Users },
  { key: 'matches', label: 'Matches', icon: Calendar },
  { key: 'approvals', label: 'Approvals', icon: FileText },
  { key: 'complaints', label: 'Complaints', icon: AlertTriangle }
];

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const matchesSearch = (item, query) => {
  if (!query) return true;
  const haystack = Object.values(item)
    .filter((value) => value !== null && value !== undefined)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
};

const AdminTracking = () => {
  const [data, setData] = useState({
    students: [],
    committees: [],
    games: [],
    volunteers: [],
    teams: [],
    matches: [],
    approvals: [],
    complaints: [],
    participants: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [search, setSearch] = useState('');
  const [gameFilter, setGameFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get('/dashboard/tracking');
        setData(res.data || {});
      } catch (err) {
        setError(err.response?.data?.error || 'Unable to load tracking data.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const gameOptions = useMemo(() => {
    const values = (data.games || []).map((game) => game.name);
    return ['all', ...new Set(values)];
  }, [data.games]);

  const filteredStudents = useMemo(() => (data.students || []).filter((item) => {
    const gameMatch = gameFilter === 'all' || item.game_id === undefined || item.game_id === null;
    const searchMatch = matchesSearch(item, search);
    return gameMatch && searchMatch;
  }), [data.students, gameFilter, search]);

  const filteredCommittees = useMemo(() => (data.committees || []).filter((item) => {
    const gameMatch = gameFilter === 'all' || item.game_name === gameFilter;
    const searchMatch = matchesSearch(item, search);
    return gameMatch && searchMatch;
  }), [data.committees, gameFilter, search]);

  const filteredGames = useMemo(() => (data.games || []).filter((item) => {
    const gameMatch = gameFilter === 'all' || item.name === gameFilter;
    const statusMatch = statusFilter === 'all' || item.status === statusFilter || item.approval_status === statusFilter;
    const searchMatch = matchesSearch(item, search);
    return gameMatch && statusMatch && searchMatch;
  }), [data.games, gameFilter, search, statusFilter]);

  const filteredVolunteers = useMemo(() => (data.volunteers || []).filter((item) => {
    const searchMatch = matchesSearch(item, search);
    return searchMatch;
  }), [data.volunteers, search]);

  const filteredTeams = useMemo(() => (data.teams || []).filter((item) => {
    const gameMatch = gameFilter === 'all' || item.game_name === gameFilter;
    const statusMatch = statusFilter === 'all' || item.verification_status === statusFilter;
    const searchMatch = matchesSearch(item, search);
    return gameMatch && statusMatch && searchMatch;
  }), [data.teams, gameFilter, search, statusFilter]);

  const filteredMatches = useMemo(() => (data.matches || []).filter((item) => {
    const gameMatch = gameFilter === 'all' || item.game_name === gameFilter;
    const statusMatch = statusFilter === 'all' || item.status === statusFilter;
    const searchMatch = matchesSearch(item, search);
    return gameMatch && statusMatch && searchMatch;
  }), [data.matches, gameFilter, search, statusFilter]);

  const filteredApprovals = useMemo(() => (data.approvals || []).filter((item) => {
    const gameMatch = gameFilter === 'all' || item.game_name === gameFilter;
    const statusMatch = statusFilter === 'all' || item.status === statusFilter;
    const searchMatch = matchesSearch(item, search);
    return gameMatch && statusMatch && searchMatch;
  }), [data.approvals, gameFilter, search, statusFilter]);

  const filteredParticipants = useMemo(() => (data.participants || []).filter((item) => {
    const gameMatch = gameFilter === 'all' || item.game_name === gameFilter;
    const searchMatch = matchesSearch(item, search);
    return gameMatch && searchMatch;
  }), [data.participants, gameFilter, search]);

  const filteredComplaints = useMemo(() => (data.complaints || []).filter((item) => {
    const statusMatch = statusFilter === 'all' || item.status === statusFilter;
    const searchMatch = matchesSearch(item, search);
    return statusMatch && searchMatch;
  }), [data.complaints, search, statusFilter]);

  return (
    <Layout>
      <div className="oswms-container oswms-page">
        <PageHeader
          eyebrow="Admin"
          title="Tracking center"
          subtitle="Monitor students, committee members, games, volunteers, teams, matches, approvals and complaints from one place."
          actions={(
            <Link className="btn btn-oswms-ghost btn-sm" to="/admin">Back to admin</Link>
          )}
        />

        {error && (
          <div className="oswms-alert-banner oswms-alert-banner--danger mb-4">{error}</div>
        )}

        <div className="row g-3 mb-4">
          {[
            { label: 'Students', value: (data.students || []).length, icon: Users },
            { label: 'Committees', value: (data.committees || []).length, icon: ShieldCheck },
            { label: 'Games', value: (data.games || []).length, icon: Trophy },
            { label: 'Volunteers', value: (data.volunteers || []).length, icon: UserRound },
            { label: 'Teams', value: (data.teams || []).length, icon: Users }
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="col-6 col-lg">
              <div className="oswms-card p-3 h-100">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <div className="text-muted small">{label}</div>
                    <div className="fw-bold fs-4">{value}</div>
                  </div>
                  <div className="rounded-circle bg-light d-flex align-items-center justify-content-center" style={{ width: 42, height: 42 }}>
                    <Icon size={18} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="oswms-card p-4 mb-4">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label small fw-semibold d-flex align-items-center gap-2"><Search size={15} /> Search</label>
              <input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, team, status..." />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold d-flex align-items-center gap-2"><Filter size={15} /> Game</label>
              <select className="form-select" value={gameFilter} onChange={(e) => setGameFilter(e.target.value)}>
                {gameOptions.map((game) => <option key={game} value={game}>{game === 'all' ? 'All games' : game}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Status</label>
              <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="pending_review">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="verified">Verified</option>
                <option value="pending_verification">Pending verification</option>
                <option value="open">Open</option>
                <option value="scheduled">Scheduled</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 mb-4">
          {sectionButtons.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" className={`btn btn-sm ${activeSection === key ? 'btn-oswms-primary' : 'btn-outline-secondary'}`} onClick={() => setActiveSection(key)}>
              <Icon size={15} className="me-1" /> {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="oswms-card p-5 text-center text-muted">Loading tracking data…</div>
        ) : (
          <>
            {activeSection === 'overview' ? (
              <div className="row g-4">
                {[
                  { title: 'Students', count: (data.students || []).length, items: (data.students || []).slice(0, 4), key: 'students' },
                  { title: 'Committees', count: (data.committees || []).length, items: (data.committees || []).slice(0, 4), key: 'committees' },
                  { title: 'Games', count: (data.games || []).length, items: (data.games || []).slice(0, 4), key: 'games' },
                  { title: 'Volunteers', count: (data.volunteers || []).length, items: (data.volunteers || []).slice(0, 4), key: 'volunteers' },
                  { title: 'Participants', count: (data.participants || []).length, items: (data.participants || []).slice(0, 4), key: 'participants' }
                ].map((card) => (
                  <div key={card.title} className="col-lg-6">
                    <div className="oswms-card p-4 h-100">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h2 className="h6 fw-bold mb-0">{card.title}</h2>
                        <span className="badge bg-light text-dark">{card.count}</span>
                      </div>
                      {card.items.length === 0 ? <p className="text-muted small mb-0">No records found.</p> : (
                        <div className="d-grid gap-2">
                          {card.items.map((item, index) => (
                            <div key={`${card.title}-${index}`} className="border rounded p-2 small">
                              {card.title === 'Students' && `${item.full_name || item.username} • ${item.email || 'No email'}`}
                              {card.title === 'Committees' && `${item.full_name || item.username} • ${item.game_name || 'No game'}`}
                              {card.title === 'Games' && `${item.name} • ${item.status}`}
                              {card.title === 'Volunteers' && `${item.full_name} • ${item.role}`}
                              {card.title === 'Participants' && `${item.full_name} • ${item.game_name || 'No game'}`}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : activeSection === 'students' ? (
              <div className="oswms-card p-4">
                <h2 className="h6 fw-bold mb-3">Student records</h2>
                {filteredStudents.length === 0 ? <p className="text-muted small mb-0">No student records match the current filters.</p> : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Username</th>
                          <th>Email</th>
                          <th>Class</th>
                          <th>Role</th>
                          <th>Joined</th>
                          <th>Team joins</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => (
                          <tr key={student.id}>
                            <td>{student.full_name || student.username}</td>
                            <td>{student.username}</td>
                            <td>{student.email || '—'}</td>
                            <td>{student.student_class || '—'}</td>
                            <td>{student.assigned_role || '—'}</td>
                            <td>{formatDate(student.created_at)}</td>
                            <td>{student.accepted_team_memberships || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeSection === 'committees' ? (
              <div className="oswms-card p-4">
                <h2 className="h6 fw-bold mb-3">Committee records</h2>
                {filteredCommittees.length === 0 ? <p className="text-muted small mb-0">No committee records match the current filters.</p> : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Assigned game</th>
                          <th>Email</th>
                          <th>Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCommittees.map((member) => (
                          <tr key={member.id}>
                            <td>{member.full_name || member.username}</td>
                            <td>{member.game_name || '—'}</td>
                            <td>{member.email || '—'}</td>
                            <td>{member.phone || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeSection === 'games' ? (
              <div className="oswms-card p-4">
                <h2 className="h6 fw-bold mb-3">Game records</h2>
                {filteredGames.length === 0 ? <p className="text-muted small mb-0">No game records match the current filters.</p> : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th>Game</th>
                          <th>Sport</th>
                          <th>Status</th>
                          <th>Approval</th>
                          <th>Teams</th>
                          <th>Matches</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredGames.map((game) => (
                          <tr key={game.id}>
                            <td>{game.name}</td>
                            <td>{game.sport_type}</td>
                            <td>{game.status}</td>
                            <td>{game.approval_status}</td>
                            <td>{game.team_count || 0}</td>
                            <td>{game.match_count || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeSection === 'volunteers' ? (
              <div className="oswms-card p-4">
                <h2 className="h6 fw-bold mb-3">Volunteer records</h2>
                {filteredVolunteers.length === 0 ? <p className="text-muted small mb-0">No volunteer records match the current filters.</p> : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Email</th>
                          <th>Shifts</th>
                          <th>Completed</th>
                          <th>Attendance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVolunteers.map((volunteer) => (
                          <tr key={volunteer.id}>
                            <td>{volunteer.full_name}</td>
                            <td>{volunteer.role}</td>
                            <td>{volunteer.email || '—'}</td>
                            <td>{volunteer.shift_count || 0}</td>
                            <td>{volunteer.completed_shifts || 0}</td>
                            <td>{volunteer.attended_count || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeSection === 'participants' ? (
              <div className="oswms-card p-4">
                <h2 className="h6 fw-bold mb-3">Participant records</h2>
                {filteredParticipants.length === 0 ? <p className="text-muted small mb-0">No participant records match the current filters.</p> : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Game</th>
                          <th>Role</th>
                          <th>Member role</th>
                          <th>Email</th>
                          <th>Class</th>
                          <th>Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredParticipants.map((participant) => (
                          <tr key={participant.id}>
                            <td>{participant.full_name}</td>
                            <td>{participant.game_name || '—'}</td>
                            <td>{participant.role || '—'}</td>
                            <td>{participant.member_role || '—'}</td>
                            <td>{participant.email || '—'}</td>
                            <td>{participant.student_class || '—'}</td>
                            <td>{participant.phone || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeSection === 'teams' ? (
              <div className="oswms-card p-4">
                <h2 className="h6 fw-bold mb-3">Team records</h2>
                {filteredTeams.length === 0 ? <p className="text-muted small mb-0">No team records match the current filters.</p> : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th>Game</th>
                          <th>Captain</th>
                          <th>Status</th>
                          <th>Members</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTeams.map((team) => (
                          <tr key={team.id}>
                            <td>{team.name}</td>
                            <td>{team.game_name}</td>
                            <td>{team.captain_name}</td>
                            <td>{team.verification_status}</td>
                            <td>{team.member_count || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeSection === 'matches' ? (
              <div className="oswms-card p-4">
                <h2 className="h6 fw-bold mb-3">Match records</h2>
                {filteredMatches.length === 0 ? <p className="text-muted small mb-0">No match records match the current filters.</p> : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th>Game</th>
                          <th>Fixture</th>
                          <th>Status</th>
                          <th>Score</th>
                          <th>Scheduled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMatches.map((match) => (
                          <tr key={match.id}>
                            <td>{match.game_name}</td>
                            <td>{match.team_a_name || 'TBD'} vs {match.team_b_name || 'TBD'}</td>
                            <td>{match.status}</td>
                            <td>{match.score_a}-{match.score_b}</td>
                            <td>{formatDate(match.scheduled_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeSection === 'approvals' ? (
              <div className="oswms-card p-4">
                <h2 className="h6 fw-bold mb-3">Approval records</h2>
                {filteredApprovals.length === 0 ? <p className="text-muted small mb-0">No approval records match the current filters.</p> : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th>Game</th>
                          <th>Requested by</th>
                          <th>Status</th>
                          <th>Requested at</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredApprovals.map((approval) => (
                          <tr key={approval.id}>
                            <td>{approval.game_name || '—'}</td>
                            <td>{approval.submitted_by_name || approval.submitted_by_username || '—'}</td>
                            <td>{approval.status}</td>
                            <td>{formatDate(approval.requested_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="oswms-card p-4">
                <h2 className="h6 fw-bold mb-3">Complaint records</h2>
                {filteredComplaints.length === 0 ? <p className="text-muted small mb-0">No complaint records match the current filters.</p> : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Subject</th>
                          <th>Status</th>
                          <th>Submitted by</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredComplaints.map((complaint) => (
                          <tr key={complaint.id}>
                            <td>{complaint.complaint_code}</td>
                            <td>{complaint.subject}</td>
                            <td>{complaint.status}</td>
                            <td>{complaint.submitted_by}</td>
                            <td>{formatDate(complaint.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default AdminTracking;
