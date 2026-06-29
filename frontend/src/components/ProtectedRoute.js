import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, role }) => {
  const { token, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!token || !user) return <Navigate to="/login" replace />;

  if (role === 'admin' && user.role !== 'Major_Admin') {
    if (user.role === 'Committee_Member') return <Navigate to="/committee" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  if (role === 'committee' && user.role !== 'Committee_Member') {
    if (user.role === 'Major_Admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  if (role === 'participant') {
    if (user.role === 'Major_Admin') return <Navigate to="/admin" replace />;
    if (user.role === 'Committee_Member') return <Navigate to="/committee" replace />;
  }

  return children;
};

export default ProtectedRoute;
