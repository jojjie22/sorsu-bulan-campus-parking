import React, {useEffect, useState} from 'react';
import { RefreshCw } from 'lucide-react';
import {api, post} from '../api.js';
import {Empty, PageHead} from '../ui/index.js';

/** Evaluates the same ranking function used by the gate, without booking a slot. */
export default function AllocationPage({user,notify}) {
  const isAdmin=user.role==='admin';
  const canEvaluate=isAdmin||user.role==='guard';
  const [policies,setPolicies]=useState([]);
  const [areas,setAreas]=useState([]);
  const [vehicles,setVehicles]=useState([]);
  const [selected,setSelected]=useState('');
  const [evaluation,setEvaluation]=useState(null);
  const [preference,setPreference]=useState('');

  async function reload() {
    try {
      const [a,v,pref]=await Promise.all([api('areas'),api('vehicles'),api('allocation/preference')]);
      setAreas(a.items);setVehicles(v.items);setPreference(pref.preferred_area_id == null?'':String(pref.preferred_area_id));
      if(isAdmin) setPolicies((await api('allocation/policies')).items);
    }catch(error){notify(error.message,true)}
  }
  useEffect(()=>{reload()},[]);

  async function evaluate(){
    if(!selected)return;
    try{setEvaluation(await api('allocation/evaluate',{params:{vehicle_id:selected}}))}
    catch(error){notify(error.message,true)}
  }
  async function savePolicy(row){
    try{await post('allocation/policies',{area_id:Number(row.id),allocation_priority:Number(row.allocation_priority),enabled:Number(row.enabled)===1});notify('Policy saved');reload()}
    catch(error){notify(error.message,true)}
  }
  async function savePreference(){
    try{await post('allocation/preference',{preferred_area_id:preference?Number(preference):null});notify('Preferred parking area saved')}
    catch(error){notify(error.message,true)}
  }

  return <>
    <PageHead eyebrow="SMART SPACE ASSIGNMENT" title="Parking allocation engine" description="Transparent capacity-aware ranking with area priorities, compatible spaces, and student/faculty preferences."/>
    {!isAdmin && <section className="panel ops-section"><div className="panel-header"><div><h3>Preferred parking area</h3><p>The gate attempts to honor this preference when compatible spaces are available.</p></div></div>
      <div className="ops-inline-form"><select value={preference} onChange={e=>setPreference(e.target.value)}><option value="">No preferred area</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><button className="btn primary" onClick={savePreference}>Save preference</button></div>
    </section>}
    {isAdmin && <section className="panel ops-section"><div className="panel-header"><div><h3>Parking area policies</h3><p>Priority 0–100; disabled areas are excluded from allocation. Save each row after editing.</p></div></div><div className="table-scroll"><table><thead><tr><th>Area</th><th>Priority</th><th>Eligible for assignment</th><th>Action</th></tr></thead><tbody>
      {policies.map(row=><tr key={row.id}><td>{row.name}</td><td><input type="number" min="0" max="100" value={row.allocation_priority} onChange={e=>setPolicies(old=>old.map(x=>x.id===row.id?{...x,allocation_priority:e.target.value}:x))}/></td>
      <td><select value={String(row.enabled)} onChange={e=>setPolicies(old=>old.map(x=>x.id===row.id?{...x,enabled:e.target.value}:x))}><option value="1">Enabled</option><option value="0">Disabled</option></select></td>
      <td><button className="btn outline" onClick={()=>savePolicy(row)}>Save policy</button></td></tr>)}
    </tbody></table></div></section>}
    {canEvaluate && <section className="panel ops-section"><div className="panel-header"><div><h3>Compare allocation algorithms</h3><p>Preview without entering the gate or changing occupancy.</p></div><RefreshCw size={18}/></div>
      <div className="ops-inline-form"><select value={selected} onChange={e=>{setSelected(e.target.value);setEvaluation(null)}}><option value="">Choose a registered vehicle</option>{vehicles.filter(v=>v.verification_status==='verified').map(v=><option key={v.id} value={v.id}>{v.plate_number} · {v.vehicle_type}</option>)}</select><button className="btn primary" disabled={!selected} onClick={evaluate}>Evaluate assignment</button></div>
      {evaluation && <><div className="ops-metric-grid"><div className="ops-metric"><small>Weighted algorithm</small><strong>{evaluation.chosen?`${evaluation.chosen.area} / ${evaluation.chosen.code}`:'No free space'}</strong></div><div className="ops-metric"><small>Alphabetical baseline</small><strong>{evaluation.baseline?`${evaluation.baseline.area} / ${evaluation.baseline.code}`:'No free space'}</strong></div><div className="ops-metric"><small>Available candidates</small><strong>{evaluation.total_candidates}</strong></div></div>
      <div className="table-scroll"><table><thead><tr><th>Rank</th><th>Area & slot</th><th>Preference</th><th>Free/compatible capacity</th><th>Policy</th><th>Score</th></tr></thead><tbody>
      {evaluation.recommended.map((r,i)=><tr key={r.id}><td>{i+1}</td><td>{r.area} / {r.code}</td><td>{r.preferred?'Yes':'No'}</td><td>{r.free_compatible} / {r.total_compatible}</td><td>{r.priority}</td><td>{r.score}</td></tr>)}
      </tbody></table>{!evaluation.recommended.length&&<Empty text="No compatible available space"/>}</div></>}
    </section>}
    <p className="ops-footnote">Weighted score = preferred area (100) + administrative area priority (up to 40) + fraction of free compatible capacity (up to 40) + exact vehicle-type fit (5). This is an explainable heuristic, not a proven globally optimal routing algorithm. The comparison is a side-by-side decision preview; evaluate measured outcomes in a pilot before claiming congestion reduction.</p>
  </>;
}
