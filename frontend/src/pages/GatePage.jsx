import React, { useCallback, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCircle2, ScanLine, ShieldCheck } from 'lucide-react';
import { post } from '../api.js';
import { cap, fmtDate } from '../lib/utils.js';
import { PageHead } from '../ui/index.js';
import CameraScanner from '../components/gate/CameraScanner.jsx';
import GateRecentActivity from '../components/gate/GateRecentActivity.jsx';

/** Camera stays in continuous-service mode, pausing only to confirm each vehicle. */
export default function Gate({notify}) {
  const [scanning,setScanning] = useState(false);
  const [qr,setQr] = useState('');
  const [verified,setVerified] = useState(null);
  const [observedPlate,setObservedPlate] = useState('');
  const [busy,setBusy] = useState(false);
  const [revision,setRevision] = useState(0);
  const [lastAction,setLastAction] = useState(null);
  const [arrivalId,setArrivalId] = useState(null);
  const [gateLabel,setGateLabel] = useState('Main Gate');
  const scanStartedAt = useRef(null);
  const verificationCompletedAt = useRef(null);
  const [scanMs,setScanMs] = useState(null);

  const markArrival=async()=>{
    try{const result=await post('gate/arrival',{gate_label:gateLabel});setArrivalId(result.arrival_id);notify('Vehicle arrival timestamp recorded');}
    catch(error){notify(error.message,true)}
  };

  const verify=useCallback(async value=>{
    const payload=String(value||'').trim();
    if(!payload)return;
    setScanning(false);setBusy(true);setVerified(null);setObservedPlate('');
    const elapsed=scanStartedAt.current==null?null:Math.max(0,Math.round(performance.now()-scanStartedAt.current));
    setScanMs(elapsed);
    try{
      const result=await post('gate/verify',{qr:payload,scan_ms:elapsed,gate_label:gateLabel});
      setQr(payload);setVerified(result);setLastAction(null);verificationCompletedAt.current=performance.now();
      notify('QR verified. Confirm the physical plate before proceeding.');
    }catch(e){notify(e.message,true);scanStartedAt.current=performance.now();setScanning(true);}
    finally{setBusy(false);}
  },[notify,gateLabel]);

  const onScan=useCallback(payload=>verify(payload),[verify]);
  const toggleScanner=()=>{if(!scanning)scanStartedAt.current=performance.now();setScanning(x=>!x)};
  const plateMatches=verified && observedPlate.replace(/[^a-z0-9]/gi,'').toUpperCase()===verified.permit.plate_number.replace(/[^a-z0-9]/gi,'').toUpperCase();

  async function finish(){
    if(!verified||!plateMatches)return;
    setBusy(true);
    try{
      const confirmMs=verificationCompletedAt.current==null?null:Math.round(performance.now()-verificationCompletedAt.current);
      const result=await post('gate/record',{qr,action:verified.suggested_action,observed_plate:observedPlate,arrival_id:arrivalId,gate_label:gateLabel,scan_ms:scanMs,confirm_ms:confirmMs});
      setLastAction(result);setVerified(null);setQr('');setObservedPlate('');setArrivalId(null);
      setRevision(x=>x+1);
      notify(result.message);
      // Resume automatically. Scanner's one-shot lock resets on reactivation.
      scanStartedAt.current=performance.now();setScanning(true);
    }catch(e){notify(e.message,true);setVerified(null);setQr('');setScanning(true);}
    finally{setBusy(false);}
  }

  return <>
    <PageHead eyebrow="SECURITY OPERATIONS" title="Fast QR entry & exit" description="Live single-use QR · automatic space assignment · physical plate verification · anti-passback"/>
    {lastAction&&<div className="gate-success-notice" role="status"><CheckCircle2 size={20}/><span>
      <strong>{lastAction.plate_number}</strong> — {lastAction.message} · {lastAction.slot?.area} / {lastAction.slot?.code}
      </span><button className="btn outline" onClick={()=>{setLastAction(null);setScanning(true)}}>Next vehicle</button></div>}
    <div className="gate-layout"><section className="panel gate-card">
      <div className="panel-header"><div><h3>Continuous scanner</h3><p>Camera restarts after each successful gate action</p></div><ScanLine size={22}/></div>
      <div className="ops-inline-form ops-gate-arrival"><input aria-label="Gate label" value={gateLabel} maxLength={40} onChange={e=>setGateLabel(e.target.value)} placeholder="Gate name"/>
        <button className="btn outline" onClick={markArrival} disabled={Boolean(arrivalId)}>Mark vehicle arrival</button>
        {arrivalId&&<span className="ops-arrival-tag">Arrival #{arrivalId} marked</span>}</div>
      <CameraScanner active={scanning&&!verified&&!busy} onScan={onScan} onError={message=>notify(message,true)}/>
      <div className="gate-actions"><button type="button" className="btn primary" onClick={toggleScanner} disabled={!!verified||busy}>
        <ScanLine size={18}/>{scanning?'Pause camera':'Start continuous scanning'}</button>
        <div className="divider-text">OR PASTE LIVE QR TEXT</div>
        <textarea value={qr} onChange={e=>setQr(e.target.value)} placeholder="CPD|permit-code|short-lived-token" rows="3" disabled={!!verified}/>
        <button className="btn outline" onClick={()=>verify(qr)} disabled={!qr.trim()||busy||!!verified}>Verify QR <ArrowRight size={16}/></button>
      </div></section>
      <section className="panel gate-details"><div className="panel-header"><div><h3>Guard plate confirmation</h3><p>Do not admit a vehicle until the physical license plate matches</p></div><ShieldCheck size={22}/></div>
      {verified?<div className="verified-details">
        <div className="verified-banner"><CheckCircle2 size={23}/><div><strong>Short-lived QR verified</strong><p>Double-check the plate printed on the actual vehicle</p></div></div>
        <div className="detail-row"><span>Registered plate</span><strong>{verified.permit.plate_number}</strong></div>
        <div className="detail-row"><span>Owner</span><strong>{verified.permit.full_name}</strong></div>
        <div className="detail-row"><span>Vehicle</span><strong>{verified.permit.brand} {verified.permit.model} · {cap(verified.permit.vehicle_type)}</strong></div>
        <div className="detail-row"><span>Permit expires</span><strong>{verified.permit.expires_at}</strong></div>
        <div className="detail-row"><span>Action</span><strong>{verified.suggested_action==='entry'?'ENTRY — assign best-ranked available slot':'EXIT — release occupied slot'}</strong></div>
        {verified.current_visit&&<div className="current-visit">Currently parked at {verified.current_visit.area} / {verified.current_visit.code} since {fmtDate(verified.current_visit.entry_at)}.</div>}
        <label className="field"><span>Enter the license plate you see on the vehicle</span>
          <input autoComplete="off" value={observedPlate} onChange={e=>setObservedPlate(e.target.value)} placeholder="Look at the vehicle plate" /></label>
        {observedPlate&&!plateMatches&&<p className="warning-line">Plate does not match the registered vehicle. Entry/exit is blocked.</p>}
        <div className="gate-action-buttons"><button className="btn outline" disabled={busy} onClick={()=>{setVerified(null);setQr('');setScanning(true)}}>Cancel / rescan</button>
          <button className="btn primary" disabled={busy||!plateMatches} onClick={finish}>{verified.suggested_action==='entry'?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>} Confirm {verified.suggested_action}</button></div>
      </div>:<div className="awaiting"><ShieldCheck size={56}/><h3>Ready for next vehicle</h3><p>Scan a current QR code. The server will choose the correct gate action and automatically assign a slot on entry.</p></div>}
      </section></div>
      <GateRecentActivity revision={revision}/>
      <div className="gate-tip"><ShieldCheck size={18}/><p>Old static QR codes are rejected. Each dynamic QR is single-use and expires after 60 seconds. A duplicate vehicle entry is blocked by both application checks and database uniqueness constraints.</p></div>
  </>;
}
