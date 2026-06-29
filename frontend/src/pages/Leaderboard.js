import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';
import api from '../services/api';
import { Medal } from 'lucide-react';

const Leaderboard = () => {
  const [rows, setRows] = useState([]);
  const [games, setGames] = useState([]);
  const [gameId, setGameId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/games').then((res) => setGames(res.data.games || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = gameId ? `/leaderboard?game_id=${gameId}` : '/leaderboard';
    api.get(url)
      .then((res) => setRows(res.data.leaderboard || []))
      .finally(() => setLoading(false));
  }, [gameId]);


  return (
    <Layout>
      <div className="oswms-container oswms-page">
        <PageHeader
          eyebrow="Standings"
          title="Leaderboard"
          subtitle="Team rankings by points and goal difference."
        />

        <select
          className="form-select mb-4"
          style={{ maxWidth: 320 }}
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
        >
          <option value="">All games</option>
          {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        {loading && <LoadingScreen message="Loading standings…" />}

        {!loading && rows.length === 0 && (
          <EmptyState icon={Medal} title="No standings yet" message="Rankings appear after completed matches update the table." />
        )}

        {!loading && rows.length > 0 && (
          <div className="oswms-table-wrap">
            <table className="table oswms-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Game</th>
                  <th>Pts</th>
                  <th>W</th>
                  <th>D</th>
                  <th>L</th>
                  <th>GF</th>
                  <th>GA</th>
                  <th>GD</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td><span className="rank-badge">{i + 1}</span></td>
                    <td><strong>{r.team_name}</strong></td>
                    <td className="text-muted">{r.game_name}</td>
                    <td><strong className="text-primary">{r.points}</strong></td>
                    <td>{r.wins}</td>
                    <td>{r.draws}</td>
                    <td>{r.losses}</td>
                    <td>{r.goals_for}</td>
                    <td>{r.goals_against}</td>
                    <td className={r.goal_difference >= 0 ? 'text-success fw-semibold' : 'text-danger fw-semibold'}>
                      {r.goal_difference > 0 ? '+' : ''}{r.goal_difference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Leaderboard;
