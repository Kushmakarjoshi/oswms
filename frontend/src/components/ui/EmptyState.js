import React from 'react';
import { Inbox } from 'lucide-react';

const EmptyState = ({ icon: Icon = Inbox, title = 'Nothing here yet', message, action }) => (
  <div className="oswms-empty">
    <div className="oswms-empty-icon">
      <Icon size={28} />
    </div>
    <h3 className="h6 fw-semibold text-dark mb-1">{title}</h3>
    {message && <p className="small mb-3">{message}</p>}
    {action}
  </div>
);

export default EmptyState;
