import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Bell, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/events', label: 'Events' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/leaderboard', label: 'Leaderboard' }
];

const Navbar = () => {
  const location = useLocation();
  const { user, isLoggedIn, isAdmin, isCommittee, logout } = useAuth();

  const dashboardPath = isAdmin ? '/admin' : isCommittee ? '/committee' : '/dashboard';
  const dashboardLabel = isAdmin ? 'Admin' : isCommittee ? 'Committee' : 'Dashboard';

  const roleClass = isAdmin ? 'oswms-role-admin' : isCommittee ? 'oswms-role-committee' : 'oswms-role-student';
  const roleLabel = isAdmin ? 'Major Admin' : isCommittee ? 'Committee' : 'Student';

  return (
    <nav className="navbar navbar-expand-lg oswms-navbar sticky-top">
      <div className="oswms-container">
        <Link className="navbar-brand d-flex align-items-center gap-2" to="/">
          <span className="d-inline-flex align-items-center justify-content-center rounded-3 text-white"
            style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' }}>
            <Activity size={20} />
          </span>
          OSWMS
        </Link>
        <button className="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navMain" aria-label="Menu">
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="navMain">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0 gap-lg-1">
            {NAV.map(({ to, label }) => (
              <li className="nav-item" key={to}>
                <Link
                  className={`nav-link ${location.pathname === to ? 'active' : ''}`}
                  to={to}
                >
                  {label}
                </Link>
              </li>
            ))}
            {!isAdmin && !isCommittee && isLoggedIn && (
              <li className="nav-item">
                <Link className={`nav-link ${location.pathname === '/teams' ? 'active' : ''}`} to="/teams">Teams</Link>
              </li>
            )}
            {isLoggedIn && isAdmin && (
              <>
                <li className="nav-item">
                  <Link className={`nav-link ${location.pathname === '/payments' ? 'active' : ''}`} to="/payments">Payments</Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ${location.pathname === '/admin/tracking' ? 'active' : ''}`} to="/admin/tracking">Tracking</Link>
                </li>
              </>
            )}
          </ul>
          <div className="d-flex align-items-center gap-2 flex-wrap py-2 py-lg-0">
            {isLoggedIn && (
              <span className={`oswms-role-chip ${roleClass} d-none d-md-inline`}>{roleLabel}</span>
            )}
            <Link className="btn btn-sm btn-light d-flex align-items-center" to="/announcements" title="Announcements">
              <Bell size={16} />
            </Link>
            {isLoggedIn ? (
              <>
                <Link className="btn btn-sm btn-oswms-primary d-flex align-items-center gap-1" to={dashboardPath}>
                  <LayoutDashboard size={16} />
                  {dashboardLabel}
                </Link>
                <span className="text-muted small d-none d-lg-inline text-truncate" style={{ maxWidth: 120 }}>
                  {user?.full_name}
                </span>
                <button type="button" className="btn btn-sm btn-oswms-ghost" onClick={logout} title="Logout">
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn-sm btn-oswms-ghost" to="/signup">Sign up</Link>
                <Link className="btn btn-sm btn-oswms-primary" to="/login">Sign in</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
