import React from 'react';
import { cn } from '../lib/utils.js';

/** Shared KPI presentation; values and icons come from the dashboard data model. */
export default function DashboardMetricCards({ cards }) {
  return (
    <section className="metric-grid" aria-label="Parking summary">
      {cards.map(([label, value, Icon, tone]) => (
        <article className="metric-card" key={label}>
          <div className="metric-card-top">
            <div className={cn('metric-icon', tone)}><Icon size={20} strokeWidth={1.8}/></div>
            <span className="metric-decorator" aria-hidden="true">↗</span>
          </div>
          <div className="metric-value">{value ?? '—'}</div>
          <div className="metric-label">{label}</div>
          <div className="metric-bottom">CAMPUS OVERVIEW</div>
        </article>
      ))}
    </section>
  );
}
