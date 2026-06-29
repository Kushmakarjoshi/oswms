import React from 'react';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';

const Footer = () => (
  <footer className="oswms-footer">
    <div className="oswms-container">
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="d-flex align-items-center gap-2 text-white mb-2">
            <Activity size={22} />
            <span className="fw-bold">OSWMS</span>
          </div>
          <p className="small mb-0">
            Online Sports Week Management System for Nepal Engineering College.
          </p>
        </div>
        <div className="col-6 col-md-4">
          <p className="text-white fw-semibold small mb-2">Explore</p>
          <div className="d-flex flex-column gap-1">
            <Link to="/events">Games & events</Link>
            <Link to="/schedule">Match schedule</Link>
            <Link to="/leaderboard">Leaderboard</Link>
            <Link to="/teams">Teams</Link>
          </div>
        </div>
        <div className="col-6 col-md-4">
          <p className="text-white fw-semibold small mb-2">Account</p>
          <div className="d-flex flex-column gap-1">
            <Link to="/login">Sign in</Link>
            <Link to="/signup">Create account</Link>
            <Link to="/complaints">Submit complaint</Link>
            <Link to="/announcements">Announcements</Link>
          </div>
        </div>
      </div>
      <div className="pt-3 border-top border-secondary border-opacity-25 text-center small">
        &copy; {new Date().getFullYear()} OSWMS — Nepal Engineering College Sports Week
      </div>
    </div>
  </footer>
);

export default Footer;
