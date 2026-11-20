import React from 'react';
import { cap } from '../lib/utils.js';

const POSITIVE = new Set(['approved', 'verified', 'active', 'available']);
const CAUTION = new Set(['pending', 'occupied']);
const NEGATIVE = new Set(['rejected', 'unavailable', 'inactive', 'expired']);

/** Status colors always include a text label, never color-only meaning. */
export default function Status({ value }) {
  const status = String(value || '').toLowerCase();
  const tone = POSITIVE.has(status) ? 'good'
    : CAUTION.has(status) ? 'warn'
      : NEGATIVE.has(status) ? 'bad' : 'neutral';

  return <span className={`badge ${tone}`}><span className="status-dot"/>{cap(value)}</span>;
}
