import React from 'react';

const STATUS_CLASS = {
  scheduled: 'oswms-status-scheduled',
  ongoing: 'oswms-status-ongoing',
  completed: 'oswms-status-completed',
  cancelled: 'oswms-status-cancelled'
};

function statusIcon(status, live) {
  if (live) return '⏺';
  if (status === 'scheduled') return '🕒';
  if (status === 'completed') return '✓';
  if (status === 'cancelled') return '✕';
  return '';
}

const MatchStatusBadge = ({ status, live }) => {
  const cls = live ? 'oswms-badge-live' : STATUS_CLASS[status] || 'bg-secondary';
  const label = live ? 'LIVE' : (status || 'scheduled').toUpperCase();
  return (
    <span className={`badge ${cls} d-inline-flex align-items-center gap-1`}>
      <small style={{ fontSize: 12 }}>{statusIcon(status, live)}</small>
      <strong style={{ fontSize: 12 }}>{label}</strong>
    </span>
  );
};

export default MatchStatusBadge;
