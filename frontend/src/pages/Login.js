import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [status, setStatus] = useState({ loading: false, error: '' });

  const fillDemoCredentials = (accountType) => {
    if (accountType === 'admin') {
      setCredentials({ username: 'admin', password: 'admin123' });
    } else {
      setCredentials({ username: 'student0001', password: 'player123' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, error: '' });
    try {
      const response = await api.post('/auth/login', credentials);
      login(response.data.token, response.data.user);
      const role = response.data.user.role;
      if (role === 'Major_Admin') navigate('/admin');
      else if (role === 'Committee_Member') navigate('/committee');
      else navigate('/dashboard');
    } catch (error) {
      setStatus({ loading: false, error: error.response?.data?.error || 'Unable to authenticate.' });
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to access your dashboard, teams, and live match updates."
      footer={(
        <div className="mt-4 pt-3 border-top">
          <p className="small text-muted mb-2 fw-semibold">Role-based demo accounts</p>
          <div className="small text-muted">
            <p className="mb-1">Major Admin: <code>admin</code> / <code>admin123</code> — creates games and assigns committee heads.</p>
            <p className="mb-1">Student: <code>student0001</code> / <code>player123</code> — registers for teams and participates in events.</p>
            <p className="mb-2">By default, only admin and student accounts are seeded.</p>
            <p className="mb-2">Committee heads are assigned later by admin, and volunteers are assigned later by the committee head.</p>
            <div className="d-flex flex-wrap gap-2 mt-2">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => fillDemoCredentials('admin')}>Use admin demo</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => fillDemoCredentials('student')}>Use student demo</button>
            </div>
          </div>
          <p className="text-center text-muted small mb-0">
            No account? <Link to="/signup">Sign up</Link> · <Link to="/">Home</Link>
          </p>
        </div>
      )}
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Username or email</label>
          <input
            name="username"
            className="form-control form-control-lg"
            required
            autoComplete="username"
            value={credentials.username}
            onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
          />
        </div>
        <div className="mb-4">
          <label className="form-label">Password</label>
          <input
            type="password"
            name="password"
            className="form-control form-control-lg"
            required
            autoComplete="current-password"
            value={credentials.password}
            onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
          />
        </div>
        {status.error && <div className="alert alert-danger">{status.error}</div>}
        <button type="submit" className="btn btn-oswms-primary w-100 btn-lg" disabled={status.loading}>
          {status.loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
};

export default Login;
