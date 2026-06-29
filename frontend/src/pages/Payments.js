import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DollarSign, Layers, ClipboardList } from 'lucide-react';

const Payments = () => {
  const { user } = useAuth();
  const [rates, setRates] = useState([]);
  const [games, setGames] = useState([]);
  const [payments, setPayments] = useState([]);
  const [calcForm, setCalcForm] = useState({ game_id: '', include_matches: true, include_shifts: true });
  const [paymentForm, setPaymentForm] = useState({ role: 'referee', unit_type: 'per_match', amount: 0 });
  const [message, setMessage] = useState({ type: '', text: '' });

  const load = async () => {
    try {
      const [ratesRes, paymentsRes, gamesRes] = await Promise.all([
        api.get('/payments/rates'),
        user?.role === 'Major_Admin' ? api.get('/payments') : Promise.resolve({ data: { payments: [] } }),
        api.get('/games')
      ]);
      setRates(ratesRes.data.rates || []);
      setPayments(paymentsRes.data.payments || []);
      setGames(gamesRes.data.games || []);
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.error || 'Could not load payments.' });
    }
  };

  useEffect(() => { load(); }, [user]);

  const saveRate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/payments/rates', paymentForm);
      setMessage({ type: 'success', text: 'Rate saved.' });
      setPaymentForm({ role: 'referee', unit_type: 'per_match', amount: 0 });
      load();
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.error || 'Could not save rate.' });
    }
  };

  const calculate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/payments/calculate', calcForm);
      setPayments(res.data.payments || []);
      setMessage({ type: 'success', text: `Calculated ${res.data.payments.length} payment entries totaling ₹${res.data.total}.` });
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.error || 'Calculation failed.' });
    }
  };

  const stagePayments = async () => {
    try {
      await api.post('/payments/stage', { payments });
      setMessage({ type: 'success', text: 'Payments staged successfully.' });
      load();
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.error || 'Could not stage payments.' });
    }
  };

  return (
    <Layout>
      <div className="oswms-container oswms-page">
        <PageHeader
          eyebrow="Automated payments"
          title="Payments & payouts"
          subtitle="Configure rates, calculate role-based payouts, and stage records for payment processing."
          badge={<span className="badge bg-warning text-dark">{user?.role === 'Major_Admin' ? 'Major Admin' : 'Committee'}</span>}
        />

        {message.text && <div className={`alert alert-${message.type}`}>{message.text}</div>}

        <div className="row g-4">
          <div className="col-lg-4">
            <div className="oswms-card p-4">
              <h2 className="h5 mb-3"><DollarSign size={18} /> Rate table</h2>
              <form onSubmit={saveRate}>
                <div className="mb-3">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={paymentForm.role} onChange={(e) => setPaymentForm({ ...paymentForm, role: e.target.value })}>
                    <option value="referee">Referee</option>
                    <option value="linesman">Linesman</option>
                    <option value="helper">Helper</option>
                    <option value="volunteer">Volunteer</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Unit type</label>
                  <select className="form-select" value={paymentForm.unit_type} onChange={(e) => setPaymentForm({ ...paymentForm, unit_type: e.target.value })}>
                    <option value="per_match">Per match</option>
                    <option value="per_shift">Per shift</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Amount</label>
                  <input type="number" min="0" step="0.5" className="form-control" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} />
                </div>
                <button type="submit" className="btn btn-oswms-primary w-100">Save rate</button>
              </form>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="oswms-card p-4">
              <h2 className="h5 mb-3"><Layers size={18} /> Calculate payouts</h2>
              <form onSubmit={calculate} className="row g-3 align-items-end">
                <div className="col-md-4">
                  <label className="form-label">Game</label>
                  <select className="form-select" value={calcForm.game_id} onChange={(e) => setCalcForm({ ...calcForm, game_id: e.target.value })}>
                    <option value="">Select game</option>
                    {games.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" checked={calcForm.include_matches} onChange={(e) => setCalcForm({ ...calcForm, include_matches: e.target.checked })} id="includeMatches" />
                    <label className="form-check-label" htmlFor="includeMatches">Matches</label>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" checked={calcForm.include_shifts} onChange={(e) => setCalcForm({ ...calcForm, include_shifts: e.target.checked })} id="includeShifts" />
                    <label className="form-check-label" htmlFor="includeShifts">Shifts</label>
                  </div>
                </div>
                <div className="col-md-2">
                  <button type="submit" className="btn btn-oswms-primary w-100">Calculate</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="oswms-card p-4 mt-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="h5 mb-0"><ClipboardList size={18} /> Payment preview</h2>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={stagePayments}>Stage payments</button>
          </div>
          <div className="table-responsive">
            <table className="table oswms-table table-hover">
              <thead>
                <tr>
                  <th>Volunteer</th>
                  <th>Role</th>
                  <th>Source</th>
                  <th>Source ID</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan="5" className="text-muted">No payment entries calculated yet.</td></tr>
                ) : payments.map((item, index) => (
                  <tr key={index}>
                    <td>{item.full_name}</td>
                    <td>{item.role}</td>
                    <td>{item.source}</td>
                    <td>{item.source_id}</td>
                    <td>₹{item.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Payments;
