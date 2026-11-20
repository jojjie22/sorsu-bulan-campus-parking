import { useState } from 'react';
import { Plus } from 'lucide-react';
import { post } from '../api.js';
import { roles, fmtDate, cap, matches } from '../lib/utils.js';
import { Empty, Spinner, Modal, Field, FormButtons, PageHead, SearchBox } from '../ui/index.js';
import { useData } from '../hooks/useData.js';

function UsersPage({ notify }) {
    const { data, loading, reload } = useData('users');
    const [q, setQ] = useState(''), [modal, setModal] = useState(false), [form, setForm] = useState({ full_name: '', email: '', student_employee_id: '', role: 'guard', password: '' });
    const create = async (e) => { e.preventDefault(); try {
        await post('users/create', form);
        notify('User created');
        setModal(false);
        reload();
    }
    catch (e) {
        notify(e.message, true);
    } };
    const update = async (u, field, value) => { try {
        await post('users/update', { id: u.id, role: field === 'role' ? value : u.role, active: field === 'active' ? value : !!+u.active });
        notify('User updated');
        reload();
    }
    catch (e) {
        notify(e.message, true);
    } };
    return <><PageHead eyebrow="ACCESS CONTROL" title="Users & roles" description="Manage campus accounts and their assigned access permissions." action={<button className="btn primary" onClick={() => setModal(true)}><Plus size={17}/> Add user</button>}/><section className="panel table-panel"><div className="table-tools"><div><h3>Account directory</h3><p>{data.length} registered users</p></div><SearchBox value={q} onChange={setQ} placeholder="Search name or email"/></div><div className="table-scroll"><table><thead><tr><th>User</th><th>Campus ID</th><th>Role</th><th>Account</th><th>Created</th></tr></thead><tbody>{matches(data, q, ['full_name', 'email', 'student_employee_id']).map(u => <tr key={u.id}><td><strong>{u.full_name}</strong><span className="subcell">{u.email}</span></td><td className="mono">{u.student_employee_id}</td><td><select className="table-select" value={u.role} onChange={e => update(u, 'role', e.target.value)}>{Object.entries(roles).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></td><td><select className="table-select" value={String(+u.active)} onChange={e => update(u, 'active', e.target.value === '1')}><option value="1">Active</option><option value="0">Inactive</option></select></td><td>{fmtDate(u.created_at)}</td></tr>)}</tbody></table>{loading ? <Spinner /> : !matches(data, q, ['full_name', 'email', 'student_employee_id']).length && <Empty text="No users found"/>}</div></section>{modal && <Modal title="Add a campus user" onClose={() => setModal(false)}><form className="form-grid" onSubmit={create}>{['full_name', 'email', 'student_employee_id'].map(k => <Field key={k} label={cap(k)}><input required type={k === 'email' ? 'email' : 'text'} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}/></Field>)}<Field label="Role"><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field><div className="full"><Field label="Temporary password (8+ characters)"><input required minLength="8" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}/></Field></div><div className="full"><FormButtons onCancel={() => setModal(false)} label="Create user"/></div></form></Modal>}</>;
}

export default UsersPage;
