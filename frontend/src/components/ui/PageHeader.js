import React from 'react';

const PageHeader = ({ eyebrow, title, subtitle, actions, badge }) => (
  <div className="oswms-dash-header">
    <div>
      {eyebrow && <span className="oswms-eyebrow">{eyebrow}</span>}
      <h1 className="oswms-page-title h3 mb-2">{title}</h1>
      {subtitle && <p className="oswms-lead mb-0">{subtitle}</p>}
      {badge}
    </div>
    {actions && <div className="oswms-dash-header-actions">{actions}</div>}
  </div>
);

export default PageHeader;
