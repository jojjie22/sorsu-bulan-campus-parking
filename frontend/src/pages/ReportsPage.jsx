import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api.js';
import { csvDownload } from '../lib/utils.js';
import { Empty, Field, PageHead } from '../ui/index.js';

function Reports() { const [start, setStart] = useState(new Date().toISOString().slice(0, 8) + '01'), [end, setEnd] = useState(new Date().toISOString().slice(0, 10)), [report, setReport] = useState(null), [error, setError] = useState(''); const load = useCallback(async () => { try {
    setError('');
    const r = await api('reports', { params: { start, end } });
    setReport(r);
}
catch (e) {
    setError(e.message);
} }, [start, end]); useEffect(() => { load(); }, [load]); return <><PageHead eyebrow="INSIGHTS & EXPORTS" title="Parking analytics" description="View detailed daily traffic and parking area utilization for a chosen period." action={<button className="btn outline" onClick={() => csvDownload(report?.daily || [], 'campus-daily-report')}><Download size={17}/> Export CSV</button>}/><div className="date-filters"><Field label="Start date"><input type="date" value={start} onChange={e => setStart(e.target.value)}/></Field><Field label="End date"><input type="date" value={end} onChange={e => setEnd(e.target.value)}/></Field><button className="btn primary" onClick={load}><RefreshCw size={16}/> Apply</button></div>{error && <div className="error-line">{error}</div>}<div className="two-col"><section className="panel"><div className="panel-header"><div><h3>Traffic by date</h3><p>Entries recorded during the selected period</p></div></div><div className="chart-holder"><ResponsiveContainer width="100%" height="100%"><BarChart data={report?.daily || []} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e8edf4" strokeDasharray="3 3"/><XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false}/><YAxis tickLine={false} allowDecimals={false}/><Tooltip /><Bar dataKey="entries" fill="#3a6ff7" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div></section><section className="panel"><div className="panel-header"><div><h3>Traffic by area</h3><p>Number of vehicle entries per parking area</p></div></div><div className="chart-holder"><ResponsiveContainer width="100%" height="100%"><BarChart data={report?.by_area || []} layout="vertical" margin={{ top: 10, right: 15, left: 5, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#e8edf4"/><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="area" width={112} fontSize={11}/><Tooltip /><Bar dataKey="entries" fill="#10b981" radius={[0, 4, 4, 0]}/></BarChart></ResponsiveContainer></div></section></div><section className="panel table-panel"><div className="panel-header"><div><h3>Daily summary</h3><p>Data for {start} through {end}</p></div></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Entries</th><th>Exited (for visits entered that day)</th></tr></thead><tbody>{(report?.daily || []).map(x => <tr key={x.day}><td>{x.day}</td><td>{x.entries}</td><td>{x.exits}</td></tr>)}</tbody></table>{!report?.daily?.length && <Empty text="No visits during this period"/>}</div></section></>; }

export default Reports;
