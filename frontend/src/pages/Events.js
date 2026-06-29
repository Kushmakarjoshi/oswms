import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';
import api from '../services/api';
import { Trophy } from 'lucide-react';

const Events = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/games')
      .then((res) => setGames(res.data.games || []))
      .catch(() => setError('Unable to load games. Is the database running?'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="oswms-container oswms-page">
        <PageHeader
          eyebrow="Tournaments"
          title="Games & events"
          subtitle="Browse active sports, formats, and committee-managed rules for Sports Week."
        />

        {error && <div className="alert alert-danger">{error}</div>}
        {loading && <LoadingScreen message="Loading games…" />}

        {!loading && !error && games.length === 0 && (
          <EmptyState icon={Trophy} title="No games yet" message="Games will appear here once the Major Admin creates them." />
        )}

        <div className="row g-4">
          {games.map((g) => (
            <div key={g.id} className="col-md-6 col-lg-4">
              <article className="oswms-card oswms-game-card h-100">
                <div className="card-top" />
                <div className="p-4">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                    <h2 className="h5 fw-bold mb-0">{g.name}</h2>
                    <span className={`badge ${g.status === 'active' ? 'oswms-badge-approved' : g.status === 'draft' ? 'bg-secondary' : 'bg-primary'}`}>
                      {g.status}
                    </span>
                  </div>
                  <p className="text-muted small mb-2">
                    <span className="fw-semibold text-dark">{g.sport_type}</span>
                    {' · '}
                    {(g.format || '').replace('_', ' ')}
                  </p>
                  <div className="d-flex justify-content-between small mb-3">
                    <span className="text-muted">Teams</span>
                    <span className="fw-bold">{g.team_count || 0} / {g.max_teams}</span>
                  </div>
                  {g.rules && (
                    <p className="small text-muted mb-0 border-top pt-3" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {String(g.rules).replace(/^##\s*/gm, '')}
                    </p>
                  )}
                </div>
              </article>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Events;
