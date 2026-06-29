import React from 'react';

const LoadingScreen = ({ message = 'Loading…' }) => (
  <div className="oswms-loading">
    <div className="spinner-border text-primary" role="status" />
    <p className="text-muted mb-0">{message}</p>
  </div>
);

export default LoadingScreen;
