import { useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { fmtDate, matches, csvDownload } from '../lib/utils.js';
import { Status, Empty, Spinner, PageHead, SearchBox } from '../ui/index.js';
import { useData } from '../hooks/useData.js';

function Visits() { const { data, loading, reload } = useData('visits'); const [q, setQ] = useState(''); return <><PageHead eyebrow="GATE ACTIVITY" title="Entry & exit logs" description="Review recent vehicle movement records and active parking sessions." action={<button className="btn outline" onClick={reload}><RefreshCw size={16}/> Refresh</button>}/><section className="panel table-panel"><div className="table-tools"><div><h3>Recent sessions</h3><p>Showing latest 250 visits</p></div><div className="button-row"><SearchBox value={q} onChange={setQ} placeholder="Plate / slot / area"/><button className="btn outline" onClick={() => csvDownload(data, 'campus-parking-visits')}><Download size={16}/> CSV</button></div></div><div className="table-scroll"><table><thead><tr><th>Plate number</th><th>Parking space</th><th>Entry time</th><th>Exit time</th><th>Entry guard</th><th>Status</th></tr></thead><tbody>{matches(data, q, ['plate_number', 'slot', 'area']).map(v => <tr key={v.id}><td><strong>{v.plate_number}</strong></td><td>{v.area}<span className="subcell">{v.slot}</span></td><td>{fmtDate(v.entry_at)}</td><td>{fmtDate(v.exit_at)}</td><td>{v.entry_guard || '—'}</td><td><Status value={v.exit_at ? 'completed' : 'occupied'}/></td></tr>)}</tbody></table>{loading ? <Spinner /> : !matches(data, q, ['plate_number', 'slot', 'area']).length && <Empty text="No parking logs found"/>}</div></section></>; }

export default Visits;
