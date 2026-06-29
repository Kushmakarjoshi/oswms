import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Trophy } from 'lucide-react';

const AuthLayout = ({ title, subtitle, children, footer }) => (
  <div className="oswms-auth-page">
    <div className="oswms-auth-brand">
      <Link to="/" className="text-white text-decoration-none d-inline-flex align-items-center gap-2 mb-4">
        <Activity size={28} />
        <span className="fw-bold fs-5">OSWMS</span>
      </Link>
      <h1>Sports Week, managed digitally</h1>
      <p className="opacity-90 mb-4">
        Register teams, track fixtures, publish live scores, and run tournaments with role-based committees — all in one place.
      </p>
      <ul className="list-unstyled mb-0 opacity-90">
        <li className="d-flex align-items-center gap-2 mb-2">
          <Trophy size={18} /> Automated knockout & round-robin fixtures
        </li>
        <li className="d-flex align-items-center gap-2 mb-2">
          <Trophy size={18} /> Safe monotonic live scoring
        </li>
        <li className="d-flex align-items-center gap-2">
          <Trophy size={18} /> Student, committee & admin dashboards
        </li>
      </ul>
    </div>
    <div className="oswms-auth-form-wrap">
      <div className="oswms-card oswms-auth-card">
        <h1 className="h3 oswms-page-title mb-1">{title}</h1>
        {subtitle && <p className="text-muted mb-4">{subtitle}</p>}
        {children}
        {footer}
      </div>
    </div>
  </div>
);

export default AuthLayout;
