import React from 'react';

const SectionCard = ({ title, icon: Icon, headerRight, children, className = '', bodyClass = '' }) => (
  <div className={`oswms-card overflow-hidden ${className}`}>
    {title && (
      <div className="oswms-card-header">
        <h2>
          {Icon && <Icon size={18} className="text-primary" />}
          {title}
        </h2>
        {headerRight}
      </div>
    )}
    <div className={`oswms-card-body ${bodyClass}`}>{children}</div>
  </div>
);

export default SectionCard;
