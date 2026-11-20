import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, CarFront, CheckCircle2, FileBadge2, RefreshCw, ScanLine, SlidersHorizontal } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api.js';
import { Empty, PageHead } from '../ui/index.js';
import DashboardMetricCards from './DashboardMetricCards.jsx';

const REFRESH_INTERVAL_MS = 15000;
const CHART_COLORS = { primary: '#802f45', grid: '#ede7e7' };

/** One polling owner keeps every dashboard widget in sync with the same snapshot. */
export default function DashboardOverview({ user, navigate }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const data = await api('summary');
      setSummary(data);
      setError('');
    } catch (err) { setError(err.message); }
  }, []);

  useEffect(() => {
    reload();
    const intervalId = setInterval(reload, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [reload]);

  const metrics = useMemo(() => [
    ['Registered vehicles', summary?.vehicles, CarFront, 'wine'],
    ['Occupied spaces', summary?.occupied, ArrowDownLeft, 'amber'],
    ['Available spaces', summary?.available, CheckCircle2, 'green'],
    ['Active permits', summary?.active_permits, FileBadge2, 'wine'],
    ['Entries today', summary?.today_entries, ArrowUpRight, 'slate'],
  ], [summary]);

  const entries = (summary?.trend ?? []).map(item => ({
    day: item.day?.slice(5),
    entries: Number(item.entries),
  }));
  const areas = (summary?.by_area ?? []).map(item => ({
    name: item.name,
    occupied: Number(item.occupied),
    active: Number(item.active),
  }));
  const isVehicleOwner = ['student', 'faculty'].includes(user.role);
  const hasGateAccess = ['admin', 'guard'].includes(user.role);

  return (
    <>
      <PageHead
        eyebrow="CAMPUS OVERVIEW"
        title="Parking operations"
        description={`Welcome back, ${user.full_name.split(' ')[0]}. Your campus parking status at a glance.`}
        action={<button className="btn outline" onClick={reload}><RefreshCw size={16}/> Refresh data</button>}
      />
      {error && <div role="alert" className="error-line">{error}</div>}

      <DashboardMetricCards cards={metrics}/>

      {isVehicleOwner && (
        <div className="personal-strip">
          <div><span className="eyebrow">YOUR ACCOUNT</span><strong>Manage your parking access</strong>
            <p>{summary?.my_vehicles ?? '—'} registered vehicles · {summary?.my_permits ?? '—'} active permits</p></div>
          <button className="btn primary" onClick={() => navigate('vehicles')}>My vehicles <ArrowRight size={16}/></button>
        </div>
      )}

      <div className="two-col dashboard-panels">
        <section className="panel">
          <div className="panel-header"><div><span className="section-overline">TRAFFIC ANALYSIS</span><h3>Daily vehicle entries</h3><p>Gate activity over the last seven days</p></div><Activity size={19}/></div>
          <div className="chart-holder">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={entries} margin={{top:12,right:8,left:-22,bottom:0}}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={CHART_COLORS.grid}/>
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12}/>
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12}/>
                <Tooltip cursor={{ fill:'#f8f1f3' }}/>
                <Bar dataKey="entries" fill={CHART_COLORS.primary} radius={[4,4,0,0]} maxBarSize={42}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header"><div><span className="section-overline">SPACE UTILIZATION</span><h3>Occupancy by area</h3><p>Current parking allocation across campus</p></div><SlidersHorizontal size={19}/></div>
          <div className="area-bars">
            {areas.length ? areas.map(({ name, occupied, active }) => (
              <div className="area-bar" key={name}>
                <div className="area-label"><strong>{name}</strong><span>{occupied} of {active} occupied</span></div>
                <div className="bar-track"><div style={{width:`${active ? Math.min(100, occupied / active * 100) : 0}%`}}/></div>
              </div>
            )) : <Empty text="No parking areas configured"/>}
            <div className="legend"><span><i className="legend-swatch occupied"/>Occupied</span><span><i className="legend-swatch available"/>Available</span></div>
          </div>
        </section>
      </div>

      <div className="quick-header"><div><span className="section-overline">SHORTCUTS</span><h3>Quick access</h3></div></div>
      <div className="quick-grid">
        <button onClick={() => navigate('slots')}><span className="quick-icon"><SlidersHorizontal size={21}/></span><span><strong>Parking availability</strong><small>Review live spaces</small></span><ArrowRight size={18}/></button>
        <button onClick={() => navigate('permits')}><span className="quick-icon"><FileBadge2 size={21}/></span><span><strong>Parking permits</strong><small>Manage campus permits</small></span><ArrowRight size={18}/></button>
        {hasGateAccess && <button onClick={() => navigate('gate')}><span className="quick-icon"><ScanLine size={21}/></span><span><strong>Gate control</strong><small>Verify entry and exit</small></span><ArrowRight size={18}/></button>}
      </div>
    </>
  );
}
