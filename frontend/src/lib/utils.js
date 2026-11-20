const roles={admin:'Administrator',guard:'Security Guard',student:'Student',faculty:'Faculty / Staff'};
const fmtDate=s=>s?new Date(s.replace(' ','T')).toLocaleString():'—';
const cap=s=>s?String(s).replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase()):'—';
const cn=(...x)=>x.filter(Boolean).join(' ');
const matches=(items,q,fields)=>items.filter(row=>fields.some(f=>String(row[f]||'').toLowerCase().includes(q.toLowerCase())));
function csvDownload(rows,name){if(!rows.length)return;const keys=Object.keys(rows[0]);const esc=x=>'"'+String(x??'').replaceAll('"','""')+'"';const text=[keys.join(','),...rows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\r\n');const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));link.download=name+'.csv';link.click();URL.revokeObjectURL(link.href)}

export {roles,fmtDate,cap,cn,matches,csvDownload};
