import { useState, useEffect } from 'react';
import { Car, CheckCircle2, Plus, RefreshCw, XCircle } from 'lucide-react';
import { post } from '../api.js';
import { cap, cn } from '../lib/utils.js';
import { Empty, Spinner, Modal, Field, FormButtons, PageHead, SearchBox } from '../ui/index.js';
import { useData } from '../hooks/useData.js';

function Slots({ user, notify }) {
    const { data, loading, reload } = useData('slots');
    const { data: areas, reload: reloadAreas } = useData('areas');
    const [filter, setFilter] = useState('all'), [q, setQ] = useState(''), [modal, setModal] = useState(false), [editing, setEditing] = useState(null), [newArea, setNewArea] = useState(''), [form, setForm] = useState({ area_id: '', code: '', vehicle_type: 'car', status: 'active' });
    const isAdmin = user.role === 'admin';
    useEffect(() => { const t = setInterval(reload, 12000); return () => clearInterval(t); }, [reload]);
    const available = data.filter(s => s.status === 'active' && s.availability === 'available').length;
    const occupied = data.filter(s => s.status === 'active' && s.availability === 'occupied').length;
    const unavailable = data.filter(s => s.status === 'unavailable').length;
    const filtered = data.filter(s => (filter === 'all' || (filter === 'unavailable' ? s.status === 'unavailable' : s.status === 'active' && s.availability === filter)) && (`${s.code} ${s.area} ${s.vehicle_type}`.toLowerCase().includes(q.toLowerCase())));
    const open = (slot = null) => { setEditing(slot); setForm(slot ? { area_id: String(slot.area_id), code: slot.code, vehicle_type: slot.vehicle_type, status: slot.status } : { area_id: String(areas[0]?.id || ''), code: '', vehicle_type: 'car', status: 'active' }); setModal(true); };
    const submit = async (e) => { e.preventDefault(); try {
        await post(editing ? 'slots/update' : 'slots', { ...form, area_id: +form.area_id, ...(editing ? { id: editing.id } : {}) });
        notify(editing ? 'Slot updated' : 'Slot created');
        setModal(false);
        reload();
    }
    catch (e) {
        notify(e.message, true);
    } };
    const addArea = async (e) => { e.preventDefault(); try {
        await post('areas', { name: newArea });
        notify('Parking area created');
        setNewArea('');
        reloadAreas();
    }
    catch (e) {
        notify(e.message, true);
    } };
    return <><PageHead eyebrow="PARKING OPERATIONS" title={isAdmin ? 'Parking slot management' : 'Live parking availability'} description="View available, occupied, and unavailable spaces across parking areas. Updates every 12 seconds." action={<div className="button-row"><button className="btn outline" onClick={reload}><RefreshCw size={16}/> Refresh</button>{isAdmin && <button className="btn primary" onClick={() => open()}><Plus size={17}/> Add slot</button>}</div>}/>
 <div className="slot-stats"><div><div className="slot-stat-icon green"><CheckCircle2 /></div><strong>{available}</strong><span>Available</span></div><div><div className="slot-stat-icon orange"><Car /></div><strong>{occupied}</strong><span>Occupied</span></div><div><div className="slot-stat-icon grey"><XCircle /></div><strong>{unavailable}</strong><span>Unavailable</span></div></div>
 <section className="panel"><div className="table-tools"><div><h3>Parking space map</h3><p>{data.length} configured spaces in {areas.length} area(s)</p></div><SearchBox value={q} onChange={setQ} placeholder="Search slot or area"/></div><div className="filter-row">{[['all', 'All spaces'], ['available', 'Available'], ['occupied', 'Occupied'], ['unavailable', 'Unavailable']].map(([k, label]) => <button key={k} onClick={() => setFilter(k)} className={cn('filter-btn', filter === k && 'active')}>{label}</button>)}</div>{loading ? <Spinner /> : <div className="slot-grid">{filtered.map(s => { const state = s.status === 'unavailable' ? 'unavailable' : s.availability; return <button disabled={!isAdmin} onClick={() => open(s)} className={cn('slot-tile', state)} key={s.id}><span className="slot-top"><Car size={18}/><span className="slot-id">{s.code}</span></span><strong>{cap(state)}</strong><small>{s.area} · {cap(s.vehicle_type)}</small></button>; })}{!filtered.length && <Empty text="No spaces match your filter"/>}</div>}</section>
 {isAdmin && <section className="panel area-admin"><div><h3>Parking areas</h3><p>{areas.map(a => a.name).join(' · ')}</p></div><form onSubmit={addArea}><input required value={newArea} onChange={e => setNewArea(e.target.value)} placeholder="New parking area"/><button className="btn outline"><Plus size={16}/> Add area</button></form></section>}
 {modal && <Modal title={editing ? 'Edit parking slot' : 'Add parking slot'} onClose={() => setModal(false)}><form className="form-grid" onSubmit={submit}><Field label="Parking area"><select required value={form.area_id} onChange={e => setForm({ ...form, area_id: e.target.value })}><option value="">Choose area</option>{areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field><Field label="Slot code"><input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="A-01"/></Field><Field label="Vehicle type"><select value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })}><option value="car">Car</option><option value="motorcycle">Motorcycle</option><option value="any">Any</option></select></Field>{editing && <Field label="Slot status"><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="unavailable">Unavailable</option></select></Field>}<div className="full"><FormButtons onCancel={() => setModal(false)} label={editing ? 'Save changes' : 'Create slot'}/></div></form></Modal>}
 </>;
}

export default Slots;
