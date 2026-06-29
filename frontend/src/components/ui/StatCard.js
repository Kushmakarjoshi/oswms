import React from 'react';

const StatCard = ({ label, value, icon: Icon, warn }) => (
  <div className={`oswms-card oswms-stat h-100 ${warn && value > 0 ? 'oswms-stat--warn' : ''}`}>
    {Icon && (
      <div className="oswms-stat-icon">
        <Icon size={20} />
      </div>
    )}
    <div className="oswms-stat-value">{value ?? 0}</div>
    <div className="oswms-stat-label">{label}</div>
  </div>
);

export default StatCard;
