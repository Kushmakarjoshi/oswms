import React from 'react';

const InlineMessage = ({ message }) => {
  if (!message || !message.text) return null;
  const cls = `inline-alert inline-alert-${message.type || 'info'}`;
  return (
    <div className={cls} role="status" aria-live="polite" style={{ marginTop: 8 }}>
      {message.text}
    </div>
  );
};

export default InlineMessage;
