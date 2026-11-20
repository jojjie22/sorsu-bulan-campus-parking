import React from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { cn } from '../lib/utils.js';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  return (
    <div role="status" aria-live="polite" className={cn('toast', toast.err && 'error')}>
      <span>{toast.err ? <XCircle size={18}/> : <CheckCircle2 size={18}/>}</span>
      {toast.msg}
      <button type="button" aria-label="Dismiss notification" onClick={onClose}><X size={16}/></button>
    </div>
  );
}
