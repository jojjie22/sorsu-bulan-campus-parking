import React, { useCallback, useEffect, useState } from 'react';
import { Plus, QrCode, RefreshCw, Clock3 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api, post } from '../api.js';
import { matches } from '../lib/utils.js';
import { Status, Empty, Spinner, Modal, Field, FormButtons, PageHead, SearchBox } from '../ui/index.js';
import { useData } from '../hooks/useData.js';

/** A permit lives for six months; its displayed single-use access QR only lives 60 seconds. */
export default function Permits({ user, notify }) {
  const { data, loading, reload } = useData('permits');
  const { data: vehicles } = useData('vehicles', user.role !== 'guard');
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState('');
  const [q, setQ] = useState('');
  const [permitView, setPermitView] = useState(null);
  const [credential, setCredential] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [qrLoading, setQrLoading] = useState(false);
  const isAdmin = user.role === 'admin';
  const eligible = vehicles.filter(v => v.verification_status === 'verified' &&
    !data.some(p => Number(p.vehicle_id) === Number(v.id) &&
      (p.status === 'pending' || (p.status === 'approved' && p.expires_at >= new Date().toISOString().slice(0, 10)))));

  const refreshQr = useCallback(async id => {
    setQrLoading(true);
    try {
      const result = await api('permits/qr', { params: { id } });
      setCredential(result);
      setSecondsLeft(result.lifetime_seconds || 60);
    } catch(e) {
      setCredential(null);
      notify(e.message, true);
    } finally { setQrLoading(false); }
  }, [notify]);

  useEffect(() => {
    if (!permitView) return undefined;
    // Refresh before expiry. A new issuance invalidates all earlier unused QR tokens.
    const renew = setInterval(() => refreshQr(permitView.id), 40000);
    const countdown = setInterval(() => setSecondsLeft(n => Math.max(0,n-1)), 1000);
    const visible = () => { if(document.visibilityState === 'visible') refreshQr(permitView.id); };
    document.addEventListener('visibilitychange',visible);
    return () => { clearInterval(renew);clearInterval(countdown);document.removeEventListener('visibilitychange',visible); };
  }, [permitView?.id,refreshQr]);

  function openQr(p) { setPermitView(p);setCredential(null);refreshQr(p.id); }
  function closeQr(){setPermitView(null);setCredential(null);}

  async function request(e) {
    e.preventDefault();
    try { await post('permits',{vehicle_id:Number(selected)});notify('Permit request sent for review');setModal(false);setSelected('');reload(); }
    catch(e){notify(e.message,true);}
  }
  async function review(id,status){
    if(!window.confirm(`Are you sure you want to ${status} this permit?`))return;
    try{await post('permits/review',{id,status});notify('Permit '+status);reload();}
    catch(e){notify(e.message,true);}
  }
  const shown=matches(data,q,['plate_number','permit_code','full_name']);

  return <>
    <PageHead eyebrow="DIGITAL PERMITS" title={isAdmin?'Permit applications':'My parking permits'}
      description="Permit validity: six calendar months. QR access codes refresh automatically and work only once."
      action={!isAdmin && <button className="btn primary" onClick={()=>setModal(true)}><Plus size={17}/> Request permit</button>} />
    <section className="panel table-panel">
      <div className="table-tools"><div><h3>Permit records</h3><p>{data.length} application(s)</p></div><SearchBox value={q} onChange={setQ}/></div>
      <div className="table-scroll"><table><thead><tr><th>Vehicle</th>{isAdmin&&<th>Applicant</th>}<th>Permit</th><th>Expires</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{shown.map(p=><tr key={p.id}><td><strong>{p.plate_number}</strong><span className="subcell">{p.brand} {p.model}</span></td>
          {isAdmin&&<td>{p.full_name}</td>}<td className="mono">{p.permit_code||'Pending issuance'}</td><td>{p.expires_at||'—'}</td>
          <td><Status value={p.status}/></td><td><div className="actions">{p.status==='pending'&&isAdmin?
            <><button className="small-action approve" onClick={()=>review(p.id,'approved')}>Approve</button><button className="small-action reject" onClick={()=>review(p.id,'rejected')}>Reject</button></>
            :p.qr_available?<button className="small-action blue" onClick={()=>openQr(p)}><QrCode size={15}/> Live QR</button>:<span className="muted">—</span>}</div></td></tr>)}</tbody>
      </table>{loading?<Spinner/>:!shown.length&&<Empty text="No matching permits"/>}</div>
    </section>
    {modal&&<Modal title="Request a parking permit" onClose={()=>setModal(false)}><form onSubmit={request}>
      <Field label="Verified vehicle"><select required value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose vehicle</option>
        {eligible.map(v=><option key={v.id} value={v.id}>{v.plate_number} — {v.brand} {v.model}</option>)}</select></Field>
      {!eligible.length&&<p className="warning-line">Register a vehicle and wait for verification first.</p>}
      <FormButtons onCancel={()=>setModal(false)} label="Submit application" disabled={!selected}/>
    </form></Modal>}
    {permitView&&<Modal title="Live, single-use parking QR" onClose={closeQr}><div className="qr-card">
      <div className="qr-wrap">{credential&&secondsLeft>0?<QRCodeSVG value={credential.qr_payload} size={220} level="H" marginSize={2}/>:<div className="qr-placeholder">{qrLoading?'Generating code…':'QR expired. Refresh to continue.'}</div>}</div>
      <h3>{permitView.plate_number}</h3><p>{permitView.permit_code}</p>
      <p className="live-qr-clock"><Clock3 size={17}/> {secondsLeft}s remaining · Auto-renews</p>
      <small>Permit valid through {permitView.expires_at}. The QR is valid for 60 seconds, then replaced. It is consumed on successful entry or exit and must not be shared.</small>
      <button className="btn outline" disabled={qrLoading} onClick={()=>refreshQr(permitView.id)}><RefreshCw size={16}/> Generate fresh QR</button>
    </div></Modal>}
  </>;
}
