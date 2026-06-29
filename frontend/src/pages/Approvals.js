import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import api from '../services/api';
import InlineMessage from '../components/ui/InlineMessage';
import { useAuth } from '../context/AuthContext';
import { Check, X, Shield } from 'lucide-react';

const Approvals = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ game_id: '', request_notes: '' });
  const [games, setGames] = useState([]);
  const [requestMsg, setRequestMsg] = useState({ type: '', text: '' });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);

  const loadApprovals = useCallback(async () => {
    try {
      const [gamesRes, approvalsRes] = await Promise.all([
        api.get('/games'),
        user?.role === 'Major_Admin' ? api.get('/approvals') : Promise.resolve({ data: { approvals: [] } })
      ]);
      setGames(gamesRes.data.games || []);
      setRequests(approvalsRes.data.approvals || []);
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.error || 'Unable to load approval data.' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const submitRequest = async (e) => {
    e.preventDefault();
    try {
      await api.post('/approvals/request', form);
      setRequestMsg({ type: 'success', text: 'Approval request submitted. SWECAD will review it shortly.' });
      setForm({ game_id: '', request_notes: '' });
    } catch (err) {
      setRequestMsg({ type: 'danger', text: err.response?.data?.error || 'Could not submit request.' });
    }
  };

  const reviewRequest = async (id, status) => {
    try {
      await api.patch(`/approvals/${id}/review`, { status });
      setMessage({ type: 'success', text: `Request ${status}.` });
      loadApprovals();
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.error || 'Review failed.' });
    }
  };

  return (
    <Layout>
      <div className="oswms-container oswms-page">
        <PageHeader
          eyebrow="SWECAD Approval"
          title="Event approvals"
          subtitle="Committee members can submit approval requests for their assigned game, and the Major Admin reviews those requests."
          badge={<span className="badge bg-primary">{user?.role === 'Major_Admin' ? 'Admin view' : 'Requester view'}</span>}
        />

        {message.text && <div className={`alert alert-${message.type}`}>{message.text}</div>}

        <div className="row g-4">
          <div className="col-lg-6">
            <div className="oswms-card p-4">
              <h2 className="h5 mb-3">Request approval</h2>
              <InlineMessage message={requestMsg} />
              <form onSubmit={submitRequest}>
                <div className="mb-3">
                  <label className="form-label">Game</label>
                  <select className="form-select" required value={form.game_id} onChange={(e) => setForm({ ...form, game_id: e.target.value })}>
                    <option value="">Select game</option>
                    {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Notes for SWECAD</label>
                  <textarea className="form-control" rows={4} value={form.request_notes} onChange={(e) => setForm({ ...form, request_notes: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-oswms-primary w-100">Submit request</button>
              </form>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="oswms-card p-4">
              <h2 className="h5 mb-3">How it works</h2>
              <p className="small text-muted mb-2">Approval requests move through SWECAD workflows so event schedules and budgets are verified before publishing.</p>
              <ul className="list-unstyled small">
                <li>• Committee members submit a request for their assigned game.</li>
                <li>• Major Admin reviews and approves or rejects it.</li>
                <li>• Approved events update the game approval status.</li>
              </ul>
            </div>
          </div>
        </div>

        {user?.role === 'Major_Admin' && (
          <div className="oswms-card p-4 mt-4">
            <h2 className="h5 mb-3">Pending approvals</h2>
            {loading ? <p className="text-muted">Loading requests…</p> : (
              requests.length === 0 ? (
                <p className="text-muted">No approval requests are pending.</p>
              ) : (
                requests.map((req) => (
                  <div key={req.id} className="border-bottom py-3">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <strong>{req.game_name}</strong>
                        <div className="small text-muted">Requested by {req.requested_by || 'Unknown'} · {new Date(req.requested_at).toLocaleString()}</div>
                      </div>
                      <span className={`badge ${req.status === 'approved' ? 'bg-success' : req.status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>{req.status}</span>
                    </div>
                    <p className="small text-muted mb-2">{req.request_notes || 'No notes provided.'}</p>
                    {req.status === 'pending_review' && (
                      <div className="d-flex gap-2">
                        <button type="button" className="btn btn-sm btn-success" onClick={() => reviewRequest(req.id, 'approved')}><Check size={14} /> Approve</button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => reviewRequest(req.id, 'rejected')}><X size={14} /> Reject</button>
                      </div>
                    )}
                  </div>
                ))
              )
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Approvals;
