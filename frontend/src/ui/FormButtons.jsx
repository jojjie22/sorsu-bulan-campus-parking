import React from 'react';

export default function FormButtons({ onCancel, label = 'Save changes', disabled = false }) {
  return (
    <div className="form-buttons">
      <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      <button type="submit" className="btn primary" disabled={disabled}>{label}</button>
    </div>
  );
}
