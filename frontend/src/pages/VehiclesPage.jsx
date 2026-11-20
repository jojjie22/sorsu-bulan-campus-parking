import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { post } from '../api.js';
import { cap, matches } from '../lib/utils.js';
import { Status, Empty, Spinner, Modal, Field, FormButtons, PageHead, SearchBox } from '../ui/index.js';
import { useData } from '../hooks/useData.js';

function Vehicles({ user, notify }) {
    const { data, loading, reload } = useData('vehicles');
    const [q, setQ] = useState(''), [modal, setModal] = useState(false), [busy, setBusy] = useState(false);
    const [form, setForm] = useState({ plate_number: '', vehicle_type: 'car', brand: '', model: '', color: '', ownership: 'owned' });
    const isAdmin = user.role === 'admin';
    const submit = async (e) => { e.preventDefault(); setBusy(true); try {
        await post('vehicles', form);
        notify('Vehicle submitted for admin verification');
        setModal(false);
        setForm({ plate_number: '', vehicle_type: 'car', brand: '', model: '', color: '', ownership: 'owned' });
        reload();
    }
    catch (e) {
        notify(e.message, true);
    }
    finally {
        setBusy(false);
    } };
    const verify = async (id, status) => { try {
        await post('vehicles/verify', { id, status });
        notify('Vehicle ' + status);
        reload();
    }
    catch (e) {
        notify(e.message, true);
    } };
    return <><PageHead eyebrow="VEHICLE MANAGEMENT" title={isAdmin ? 'Registered vehicles' : 'My vehicles'} description={isAdmin ? 'Verify vehicle registrations from the campus community.' : 'Register your vehicles and monitor their verification status.'} action={!isAdmin && <button className="btn primary" onClick={() => setModal(true)}><Plus size={17}/> Register vehicle</button>}/><section className="panel table-panel"><div className="table-tools"><div><h3>Vehicle directory</h3><p>{data.length} registration(s)</p></div><SearchBox value={q} onChange={setQ} placeholder="Search plate, owner, brand…"/></div><div className="table-scroll"><table><thead><tr><th>Plate / Vehicle</th>{isAdmin && <th>Owner</th>}<th>Details</th><th>Ownership</th><th>Verification</th>{isAdmin && <th>Actions</th>}</tr></thead><tbody>{matches(data, q, ['plate_number', 'full_name', 'brand', 'model']).map(v => <tr key={v.id}><td><strong>{v.plate_number}</strong><span className="subcell">{cap(v.vehicle_type)}</span></td>{isAdmin && <td>{v.full_name}<span className="subcell">{v.email}</span></td>}<td>{v.brand} {v.model}<span className="subcell">{v.color}</span></td><td>{cap(v.ownership)}</td><td><Status value={v.verification_status}/></td>{isAdmin && <td><div className="actions">{v.verification_status === 'pending' ? <><button className="small-action approve" onClick={() => verify(v.id, 'verified')}><Check size={14}/> Verify</button><button className="small-action reject" onClick={() => verify(v.id, 'rejected')}><X size={14}/> Reject</button></> : <span className="muted">Reviewed</span>}</div></td>}</tr>)}</tbody></table>{!loading && !matches(data, q, ['plate_number', 'full_name', 'brand', 'model']).length && <Empty text="No matching registrations"/>}{loading && <Spinner />}</div></section>
 {modal && <Modal title="Register a vehicle" onClose={() => setModal(false)}><form className="form-grid" onSubmit={submit}><Field label="Plate number"><input required value={form.plate_number} onChange={e => setForm({ ...form, plate_number: e.target.value })} placeholder="ABC1234"/></Field><Field label="Vehicle type"><select value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })}><option value="car">Car</option><option value="motorcycle">Motorcycle</option></select></Field>{['brand', 'model', 'color'].map(k => <Field key={k} label={cap(k)}><input required maxLength={70} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} placeholder={'Enter ' + k}/></Field>)}<Field label="Ownership"><select value={form.ownership} onChange={e => setForm({ ...form, ownership: e.target.value })}><option value="owned">Owned</option><option value="family">Family-owned</option><option value="authorized">Authorized user</option></select></Field><div className="full"><FormButtons onCancel={() => setModal(false)} label="Submit vehicle" disabled={busy}/></div></form></Modal>}
 </>;
}

export default Vehicles;
