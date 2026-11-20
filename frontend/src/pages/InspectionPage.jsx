import React, { useEffect, useState } from 'react';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { api, post } from '../api.js';
import { cap, fmtDate } from '../lib/utils.js';
import { Empty, PageHead, Status } from '../ui/index.js';

const defaultInspection = { slot_id: '', observed_status: 'occupied', observed_plate: '', notes: '' };

/** Inspections never change occupancy directly. Administrators review the proposed correction. */
export default function InspectionPage({ user, notify }) {
  const [slots, setSlots] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(defaultInspection);
  const [reasons, setReasons] = useState({});
  const [resolutions, setResolutions] = useState({});
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      const [s, i, r] = await Promise.all([api('slots'), api('inspections'), api('reconciliations')]);
      setSlots(s.items); setInspections(i.items); setRequests(r.items);
    } catch (error) { notify(error.message, true); }
  }
  useEffect(() => { reload(); }, []);

  async function submitInspection(event) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await post('inspections', {
        ...form, slot_id: Number(form.slot_id),
        observed_plate: form.observed_status === 'occupied' ? form.observed_plate : '',
      });
      notify(result.item.mismatch ? 'Mismatch found. Submit a correction request for approval.' : 'Inspection matches the parking database.');
      setForm(defaultInspection); await reload();
    } catch (error) { notify(error.message, true); }
    finally { setBusy(false); }
  }

  async function requestCorrection(inspection) {
    try {
      await post('reconciliations', { inspection_id: Number(inspection.id), reason: reasons[inspection.id] || '' });
      notify('Correction request submitted for administrator approval'); await reload();
    } catch (error) { notify(error.message, true); }
  }

  async function review(request, decision) {
    if (!window.confirm(`${cap(decision)} correction #${request.id}? The approved action will modify parking visits.`)) return;
    try {
      await post('reconciliations/review', {
        id: Number(request.id), decision, resolution: resolutions[request.id] || '',
      });
      notify(`Correction ${decision}`); await reload();
    } catch (error) { notify(error.message, true); }
  }

  const pending = requests.filter(r => r.status === 'pending');
  return <>
    <PageHead eyebrow="PARKING ACCURACY" title="Occupancy inspection & reconciliation"
      description="Compare what is actually parked against the database. Every correction requires an approved request."
      action={<button className="btn outline" onClick={reload}><RefreshCw size={16}/> Refresh</button>}/>
    <section className="panel ops-section">
      <div className="panel-header"><div><h3>Record a physical slot inspection</h3><p>Security guard confirms the observed state in the parking lot.</p></div><ClipboardCheck size={20}/></div>
      <form onSubmit={submitInspection} className="ops-form-grid">
        <label className="field"><span>Parking space</span><select required value={form.slot_id} onChange={e => setForm({...form,slot_id:e.target.value})}>
          <option value="">Select a space</option>{slots.map(s => <option key={s.id} value={s.id}>{s.area} / {s.code} — database: {s.availability}</option>)}
        </select></label>
        <label className="field"><span>Observed occupancy</span><select value={form.observed_status} onChange={e => setForm({...form,observed_status:e.target.value})}>
          <option value="occupied">Vehicle physically present</option><option value="empty">Space physically empty</option>
        </select></label>
        {form.observed_status === 'occupied' && <label className="field"><span>Observed plate</span><input required maxLength={25} value={form.observed_plate} onChange={e => setForm({...form,observed_plate:e.target.value})} placeholder="Plate as seen on vehicle"/></label>}
        <label className="field"><span>Notes</span><input maxLength={500} value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} placeholder="Optional inspection notes"/></label>
        <button className="btn primary" disabled={busy || !form.slot_id}>Save inspection</button>
      </form>
    </section>
    <section className="panel ops-section"><div className="panel-header"><div><h3>Latest inspection by parking space</h3><p>Discrepancies can be submitted for review without immediately changing the database.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Slot</th><th>Observed</th><th>Recorded</th><th>Result</th><th>Correction request</th></tr></thead><tbody>
      {inspections.map(i => <tr key={i.id}><td><strong>{i.area} / {slots.find(s=>String(s.id)===String(i.slot_id))?.code || i.slot_id}</strong><span className="subcell">{fmtDate(i.created_at)}</span></td>
        <td>{cap(i.observed_status)}<span className="subcell">{i.observed_plate}</span></td><td>{cap(i.recorded_status)}<span className="subcell">{i.recorded_plate}</span></td>
        <td><Status value={Number(i.mismatch) ? 'Mismatch' : 'Matched'}/></td>
        <td>{Number(i.mismatch) && i.recorded_status==='occupied' && i.observed_status==='occupied' ? 'Different plate recorded: investigate and reinspect before correcting' : Number(i.mismatch) ? <div className="ops-inline-form"><input aria-label="Reason for discrepancy" placeholder="Reason (12+ characters)" value={reasons[i.id] || ''} onChange={e => setReasons({...reasons,[i.id]:e.target.value})}/>
        <button className="btn outline" onClick={() => requestCorrection(i)}>Request correction</button></div> : 'No correction needed'}</td></tr>)}
      </tbody></table>{!inspections.length && <Empty text="No inspections completed yet"/>}</div>
    </section>
    <section className="panel ops-section"><div className="panel-header"><div><h3>Correction approval queue</h3><p>{pending.length} pending · Only administrators can approve or reject. Actions are audited.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Request</th><th>Slot</th><th>Action</th><th>Reason</th><th>Status</th><th>Supervisor decision</th></tr></thead><tbody>
      {requests.map(r => <tr key={r.id}><td>#{r.id}<span className="subcell">{r.requester}</span></td><td>{r.area} / {r.slot_code}</td><td>{cap(r.action)}</td><td>{r.reason}</td><td><Status value={r.status}/></td>
        <td>{r.status === 'pending' && user.role === 'admin' ? <div className="ops-inline-form"><input aria-label="Supervisor decision notes" placeholder="Decision notes" value={resolutions[r.id]||''} onChange={e => setResolutions({...resolutions,[r.id]:e.target.value})}/>
        <button className="btn primary" onClick={() => review(r,'approved')}>Approve</button><button className="btn outline" onClick={() => review(r,'rejected')}>Reject</button></div> : r.resolution || 'Pending supervisor'}</td></tr>)}
      </tbody></table>{!requests.length && <Empty text="No reconciliation requests"/>}</div>
    </section>
  </>;
}
