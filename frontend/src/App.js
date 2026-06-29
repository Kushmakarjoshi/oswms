import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminDashboard from './pages/AdminDashboard';
import CommitteeDashboard from './pages/CommitteeDashboard';
import UserDashboard from './pages/UserDashboard';
import Events from './pages/Events';
import Schedule from './pages/Schedule';
import Teams from './pages/Teams';
import Leaderboard from './pages/Leaderboard';
import Complaints from './pages/Complaints';
import Announcements from './pages/Announcements';
import Payments from './pages/Payments';
import AdminTracking from './pages/AdminTracking';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/events" element={<Events />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/register" element={<Teams />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/complaints" element={<Complaints />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/payments" element={<ProtectedRoute role="admin"><Payments /></ProtectedRoute>} />
        <Route path="/admin/tracking" element={<ProtectedRoute role="admin"><AdminTracking /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute role="participant"><UserDashboard /></ProtectedRoute>} />
        <Route path="/committee" element={<ProtectedRoute role="committee"><CommitteeDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
