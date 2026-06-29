import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';
import MatchStatusBadge from '../components/ui/MatchStatusBadge';
import api from '../services/api';
import { Calendar, Radio } from 'lucide-react';

const Schedule = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [since, setSince] = useState(new Date().toISOString());

  const load = useCallback(async () => {
    try {
      const res = await api.get('/matches');
      setMatches(res.data.matches || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const pollLive = useCallback(async () => {
    try {
      const res = await api.get(`/matches/live?since=${encodeURIComponent(since)}`);
      if (res.data.updates?.length) {
        setMatches((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]));
          res.data.updates.forEach((u) => {
            const existing = map.get(u.id);
            if (existing) map.set(u.id, { ...existing, score_a: u.score_a, score_b: u.score_b, status: u.status });
          });
          return Array.from(map.values());
        });
      }
      setSince(res.data.server_time);
    } catch { /* ignore */ }
  }, [since]);

  useEffect(() => {
    // load full schedule once, then poll live updates frequently
    load();
    const liveInterval = setInterval(() => { pollLive(); }, 10000);
    const refreshInterval = setInterval(() => { load(); }, 60000);
    return () => { clearInterval(liveInterval); clearInterval(refreshInterval); };
  }, [load, pollLive]);

  const hasLive = matches.some((m) => m.status === 'ongoing');

  // Group matches for clearer display
  const liveMatches = matches.filter((m) => m.status === 'ongoing').sort((a, b) => (a.scheduled_at || '') > (b.scheduled_at || '') ? 1 : -1);
  const upcomingMatches = matches.filter((m) => m.status === 'scheduled' || !m.status).sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0));
  const completedMatches = matches.filter((m) => m.status === 'completed').sort((a, b) => new Date(b.scheduled_at || 0) - new Date(a.scheduled_at || 0));

  return (
    <Layout>
      <div className="oswms-container oswms-page">
        <PageHeader
          eyebrow="Fixtures"
          title="Match schedule"
          subtitle="All fixtures across games. Scores refresh automatically every 10 seconds."
          badge={hasLive ? <MatchStatusBadge live /> : null}
        />

        {loading && <LoadingScreen message="Loading schedule…" />}

        {!loading && matches.length === 0 && (
          <EmptyState icon={Calendar} title="No matches scheduled" message="Fixtures appear after committees generate them for verified teams." />
        )}

        {!loading && (
          <>
            {liveMatches.length > 0 && (
              <section className="mb-4">
                <h3 className="h6 mb-2">Live now <small className="text-muted">({liveMatches.length})</small></h3>
                <div className="row g-4 mb-3">
                  {liveMatches.map((m) => (
                    <div key={`live-${m.id}`} className="col-md-6 col-xl-4">
                      <article className={`oswms-card oswms-match-card oswms-match-live oswms-match-card--${m.status}`}>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <span className="badge bg-danger bg-opacity-10 text-danger">{m.game_name}</span>
                          <MatchStatusBadge status={m.status} live />
                        </div>
                        <h2 className="h5 fw-bold mb-2">{m.team_a_name || 'TBD'} <span className="text-muted fw-normal mx-1">vs</span> {m.team_b_name || 'TBD'}</h2>
                        <p className="oswms-match-score mb-2">{m.score_a} — {m.score_b}</p>
                        <p className="text-muted small mb-0">{m.venue_name || 'Venue TBD'} · {m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : 'Time TBD'}</p>
                      </article>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {upcomingMatches.length > 0 && (
              <section className="mb-4">
                <h3 className="h6 mb-2">Upcoming matches <small className="text-muted">({upcomingMatches.length})</small></h3>
                <div className="row g-4 mb-3">
                  {upcomingMatches.map((m) => (
                    <div key={`upcoming-${m.id}`} className="col-md-6 col-xl-4">
                      <article className={`oswms-card oswms-match-card oswms-match-card--${m.status}`}>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <span className="badge bg-primary bg-opacity-10 text-primary">{m.game_name}</span>
                          <MatchStatusBadge status={m.status} />
                        </div>
                        <h2 className="h5 fw-bold mb-2">{m.team_a_name || 'TBD'} <span className="text-muted fw-normal mx-1">vs</span> {m.team_b_name || 'TBD'}</h2>
                        <p className="text-muted small mb-0">{m.venue_name || 'Venue TBD'} · {m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : 'Time TBD'}</p>
                      </article>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {completedMatches.length > 0 && (
              <section className="mb-4">
                <h3 className="h6 mb-2">Completed matches <small className="text-muted">({completedMatches.length})</small></h3>
                <div className="row g-4">
                  {completedMatches.map((m) => (
                    <div key={`completed-${m.id}`} className="col-md-6 col-xl-4">
                      <article className={`oswms-card oswms-match-card oswms-match-card--${m.status}`}>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <span className="badge bg-secondary bg-opacity-10 text-secondary">{m.game_name}</span>
                          <MatchStatusBadge status={m.status} />
                        </div>
                        <h2 className="h5 fw-bold mb-2">{m.team_a_name || 'TBD'} <span className="text-muted fw-normal mx-1">vs</span> {m.team_b_name || 'TBD'}</h2>
                        <p className="oswms-match-score mb-2">{m.score_a} — {m.score_b} <small className="text-muted">(Final)</small></p>
                        <p className="text-muted small mb-0">{m.venue_name || 'Venue TBD'} · {m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : 'Time TBD'}</p>
                      </article>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default Schedule;
