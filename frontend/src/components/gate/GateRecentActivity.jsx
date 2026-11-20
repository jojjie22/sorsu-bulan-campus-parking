import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ClipboardList, RefreshCw } from 'lucide-react';
import { api } from '../../api.js';
import { fmtDate } from '../../lib/utils.js';

const REFRESH_INTERVAL_MS = 12000;

/** A single parking visit has an entry event and, optionally, an exit event. */
function asEvents(visits) {
  return visits.flatMap(visit => [
    { ...visit, id: `entry-${visit.id}`, type: 'entry', at: visit.entry_at },
    ...(visit.exit_at ? [{ ...visit, id: `exit-${visit.id}`, type: 'exit', at: visit.exit_at }] : []),
  ]).sort((a, b) => new Date(b.at.replace(' ', 'T')) - new Date(a.at.replace(' ', 'T'))).slice(0, 8);
}

export default function GateRecentActivity({ revision = 0 }) {
  const [visits, setVisits] = useState([]);
  const [error, setError] = useState('');
  const events = useMemo(() => asEvents(visits), [visits]);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await api('visits');
        if (active) { setVisits(response.items ?? []); setError(''); }
      } catch (cause) {
        if (active) setError(cause.message);
      }
    }
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => { active = false; clearInterval(interval); };
  }, [revision]);

  return (
    <section className="panel gate-activity" aria-label="Recent gate activity">
      <div className="panel-header">
        <div><h3>Recent gate activity</h3><p>Latest recorded entries and exits · refreshes automatically</p></div>
        <RefreshCw size={17} aria-hidden="true" />
      </div>
      {error && <p className="warning-line" role="alert">Couldn't refresh gate activity: {error}</p>}
      {!events.length ? (
        <div className="gate-activity-empty"><ClipboardList size={23}/><span>No gate activity has been recorded yet.</span></div>
      ) : (
        <div className="gate-activity-list">
          {events.map(event => (
            <div className="gate-activity-row" key={event.id}>
              <span className={`gate-activity-icon ${event.type}`}>
                {event.type === 'entry' ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}
              </span>
              <span className="gate-activity-vehicle"><strong>{event.plate_number}</strong><small>{event.area} · {event.slot}</small></span>
              <span className="gate-activity-meta"><strong>{event.type === 'entry' ? 'Entry' : 'Exit'}</strong><small>{fmtDate(event.at)}</small></span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
