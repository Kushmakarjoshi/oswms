import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import api from '../services/api';
import InlineMessage from '../components/ui/InlineMessage';
import { useAuth } from '../context/AuthContext';
import { MessageSquareWarning } from 'lucide-react';

const Complaints = () => {
  const { isAdmin, token } = useAuth();
  const [list, setList] = useState([]);
  const [form, setForm] = useState({
    submitted_by: '', email: '', category: 'other', subject: '', description: '', is_anonymous: false
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  const load = () => {
    if (!isAdmin || !token) {
      setList([]);
      return;
    }
    api.get('/complaints').then((res) => setList(res.data.complaints || [])).catch(() => {});
  };

  useEffect(() => { load(); }, [isAdmin, token]);

  const submit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      const res = await api.post('/complaints', form);
      setMessage({ type: 'success', text: `Submitted. Reference: ${res.data.complaint_code}` });
      setForm({ submitted_by: '', email: '', category: 'other', subject: '', description: '', is_anonymous: false });
      load();
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.error || 'Submission failed.' });
    }
  };

  return (
    <Layout>
      <div className="oswms-container oswms-page">
        <PageHeader
          eyebrow="Support"
          title="Complaints"
          subtitle="Reports go to the Major Admin only — game committees cannot see them."
        />
        <div className="row g-4">
          <div className="col-lg-5">
            <div className="oswms-card p-4">
              <InlineMessage message={message} />
              <form onSubmit={submit}>
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="anon"
                  checked={form.is_anonymous}
                  onChange={(e) => setForm({ ...form, is_anonymous: e.target.checked })}
                />
                <label className="form-check-label" htmlFor="anon">Submit anonymously</label>
              </div>
              {!form.is_anonymous && (
                <div className="mb-3">
                  <label className="form-label">Your name</label>
                  <input className="form-control" required={!form.is_anonymous} value={form.submitted_by} onChange={(e) => setForm({ ...form, submitted_by: e.target.value })} />
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="scheduling">Scheduling</option>
                  <option value="referee">Referee</option>
                  <option value="equipment">Equipment</option>
                  <option value="technical">Technical</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Subject</label>
                <input className="form-control" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows={4} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-oswms-primary w-100">Submit complaint</button>
            </form>
            </div>
          </div>
          <div className="col-lg-7">
            <div className="oswms-card p-4">
            <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2"><MessageSquareWarning size={18} /> Recent complaints</h2>
            {!isAdmin && (
              <p className="text-muted">Only the Major Admin can view submitted complaints.</p>
            )}
            {isAdmin && list.map((c) => (
              <div key={c.id} className="card mb-2 border-0 shadow-sm">
                <div className="card-body py-3">
                  <div className="d-flex justify-content-between">
                    <strong>{c.complaint_code}</strong>
                    <span className={`badge ${c.status === 'resolved' ? 'bg-success' : c.status === 'under_review' ? 'bg-warning text-dark' : 'bg-secondary'}`}>{c.status}</span>
                  </div>
                  <div className="small text-muted">{c.category} · {c.submitted_by}{c.is_anonymous ? ' (anonymous)' : ''}</div>
                  <div className="mt-1">{c.subject}</div>
                </div>
              </div>
            ))}
            {isAdmin && list.length === 0 && <p className="text-muted">No complaints yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Complaints;
