import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children }) {
  const headingId = useId();

  // Escape is a quick, predictable way to dismiss non-destructive dialogs.
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-shade" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={headingId}>
        <div className="modal-head">
          <h3 id={headingId}>{title}</h3>
          <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={19}/>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
