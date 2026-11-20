import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Download, RefreshCw } from 'lucide-react';
import { api } from '../api.js';
import { csvDownload, fmtDate } from '../lib/utils.js';
import { Empty, PageHead, Status } from '../ui/index.js';

const today = () => new Date().toLocaleDateString('en-CA');
const weekAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toLocaleDateString('en-CA');
};

/** Reports measured server time separately from user-reported scan/confirmation time. */
export default function QueueAnalyticsPage({ notify }) {
  const [start, setStart] = useState(weekAgo);
  const [end, setEnd] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api('gate/metrics', { params: { start, end } })); }
    catch (error) { notify(error.message, true); }
    finally { setLoading(false); }
  }, [start, end, notify]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const totals = data?.summary || {};
  const cards = [
    ['Verified QR scans', data?.scans?.verified_scans ?? 0],
    ['Rejected QR scans', data?.scans?.rejected_scans ?? 0],
    ['Average scan latency', data?.scans?.avg_scan_ms == null ? 'Not measured' : `${(data.scans.avg_scan_ms / 1000).toFixed(1)} sec`],
    ['Completed entries', totals.entries ?? 0],
    ['Completed exits', totals.exits ?? 0],
    ['Rejected transactions', totals.denied ?? 0],
    ['Average confirmation', totals.avg_confirm_ms == null ? 'No data' : `${(totals.avg_confirm_ms / 1000).toFixed(1)} sec`],
    ['Average observed wait', totals.avg_wait_ms == null ? 'Not recorded' : `${(totals.avg_wait_ms / 1000).toFixed(1)} sec`],
    ['Average API duration', totals.avg_server_ms == null ? 'No data' : `${totals.avg_server_ms} ms`],
  ];

  const peaks = [...(data?.hourly || [])].sort((a, b) => Number(b.entries) - Number(a.entries));

  return <>
    <PageHead eyebrow="TRAFFIC INTELLIGENCE" title="Gate & queue analytics"
      description="Track scan outcomes, gate transaction time, observed waits and peak entry hours. Refreshes every 30 seconds."
      action={<button className="btn outline" onClick={load} disabled={loading}><RefreshCw size={16}/> Refresh</button>} />
    <div className="date-filters ops-filters">
      <label className="field"><span>From</span><input type="date" value={start} onChange={e => setStart(e.target.value)}/></label>
      <label className="field"><span>To</span><input type="date" value={end} onChange={e => setEnd(e.target.value)}/></label>
      <button className="btn outline" onClick={() => csvDownload(data?.recent || [], 'gate-processing-metrics')}>
        <Download size={16}/> Export metrics
      </button>
    </div>
    <div className="ops-metric-grid">
      {cards.map(([label, value]) => <div className="ops-metric" key={label}><small>{label}</small><strong>{value}</strong></div>)}
    </div>
    <div className="two-col">
      <section className="panel"><div className="panel-header"><div><h3>Peak traffic hours</h3><p>Ranked by successful entry transactions</p></div><Activity size={19}/></div>
        <div className="ops-table-wrap"><table><thead><tr><th>Date</th><th>Hour</th><th>Gate</th><th>Entries</th><th>Denied</th></tr></thead><tbody>
          {peaks.slice(0,15).map((row,i) => <tr key={`${row.day}-${row.hour_of_day}-${i}`}>
            <td>{row.day}</td><td>{String(row.hour_of_day).padStart(2,'0')}:00</td><td>{row.gate_label}</td><td>{row.entries}</td><td>{row.denied}</td></tr>)}
        </tbody></table>{!peaks.length && <Empty text="No gate transactions in this period"/>}</div>
      </section>
      <section className="panel"><div className="panel-header"><div><h3>Recent scan outcomes</h3><p>Verified, denied and completed gate requests</p></div></div>
        <div className="ops-table-wrap"><table><thead><tr><th>Time</th><th>Event</th><th>Duration</th></tr></thead><tbody>
          {(data?.recent || []).slice(0,20).map(row => <tr key={row.id}>
            <td>{fmtDate(row.created_at)}</td><td><Status value={row.outcome}/><div className="subcell">{row.reason}</div></td>
            <td>{row.server_duration_ms} ms</td></tr>)}
        </tbody></table>{!data?.recent?.length && <Empty text="No scans recorded yet"/>}</div>
      </section>
    </div>
    <p className="ops-footnote">Scan duration and confirmation duration are client-reported measurements. Server duration is measured by the PHP API. Queue waiting time is available only when a guard marks vehicle arrival before processing. These figures are not automatically measured roadside queue length.</p>
  </>;
}
