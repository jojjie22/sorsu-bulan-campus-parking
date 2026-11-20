import { useState, useEffect } from 'react';
import { Activity, Settings2 } from 'lucide-react';
import { post } from '../api.js';
import { fmtDate, cap } from '../lib/utils.js';
import { Empty, Field, PageHead } from '../ui/index.js';
import { useData } from '../hooks/useData.js';

function Settings({ notify }) { const { data, reload } = useData('settings'); const { data: audit } = useData('audit'); const [edit, setEdit] = useState({}); useEffect(() => setEdit(Object.fromEntries(data.map(s => [s.key, s.value]))), [data]); const save = async (key) => { try {
    await post('settings', { key, value: edit[key] });
    notify('Setting saved');
    reload();
}
catch (e) {
    notify(e.message, true);
} }; return <><PageHead eyebrow="ADMINISTRATION" title="System settings" description="Configure the campus and review administrative activity."/><p className="policy-note">Approved parking permits are valid for <strong>6 calendar months</strong> from approval.</p><div className="two-col"><section className="panel settings-panel"><div className="panel-header"><div><h3>Campus configuration</h3><p>Manage core parking policy values</p></div><Settings2 size={20}/></div>{[['campus_name', 'Campus display name'], ['parking_hours', 'Parking operating hours']].map(([key, label]) => <div className="setting-row" key={key}><Field label={label}><input value={edit[key] || ''} onChange={e => setEdit({ ...edit, [key]: e.target.value })}/></Field><button className="btn outline" onClick={() => save(key)}>Save</button></div>)}</section><section className="panel"><div className="panel-header"><div><h3>Recent administrator activity</h3><p>Up to 150 recorded actions</p></div><Activity size={19}/></div><div className="audit-list">{audit.slice(0, 14).map(x => <div className="audit-item" key={x.id}><span className="audit-icon"><Activity size={16}/></span><div><strong>{cap(x.action)}</strong><p>{x.full_name || 'System'} · {x.details}</p></div><small>{fmtDate(x.created_at)}</small></div>)}{!audit.length && <Empty text="No actions recorded"/>}</div></section></div></>; }

export default Settings;
