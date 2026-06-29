import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { Megaphone } from 'lucide-react';

const Announcements = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/notifications/public')
      .then((res) => setItems(res.data.notifications || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="container py-5" style={{ maxWidth: '720px' }}>
        <div className="text-center mb-4">
          <Megaphone size={40} className="text-primary mb-2" />
          <h1 className="oswms-page-title h2">Public announcements</h1>
          <p className="text-muted">Official Sports Week updates — no login required.</p>
        </div>

        {loading && <p className="text-center">Loading…</p>}
        {!loading && items.length === 0 && (
          <div className="oswms-card p-5 text-center text-muted">No announcements published yet.</div>
        )}

        {items.map((n) => (
          <div key={n.id} className="oswms-card p-4 mb-3">
            <h2 className="h5 mb-2">{n.title}</h2>
            <p className="mb-2">{n.message}</p>
            <small className="text-muted">{new Date(n.created_at).toLocaleString()}</small>
          </div>
        ))}

        <p className="text-center text-muted small mt-4">
          For personal alerts (team approvals, scores), <a href="/signup">create an account</a> and open your dashboard.
        </p>
      </div>
    </Layout>
  );
};

export default Announcements;
