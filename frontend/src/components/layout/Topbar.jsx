import React from 'react';
import { CalendarDays, Menu, ShieldCheck } from 'lucide-react';
import { roles } from '../../lib/utils.js';

export default function Topbar({ user, title, onOpenMenu }) {
  const date = new Intl.DateTimeFormat('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date());

  return (
    <header className="topbar">
      <div className="top-left">
        <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={onOpenMenu}>
          <Menu size={21}/>
        </button>
        <div className="topbar-location"><span>Workspace</span><span className="crumb-divider">/</span><strong>{title}</strong></div>
      </div>
      <div className="top-right">
        <span className="topbar-environment"><span className="online-dot"/> SorSU BULAN CAMPUS</span>
        <span className="clock-pill"><CalendarDays size={15}/>{date}</span>
        <div className="topbar-profile">
          <div className="avatar">{user.full_name.split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase()}</div>
          <div className="user-info"><strong>{user.full_name}</strong><small>{roles[user.role]}</small></div>
        </div>
      </div>
    </header>
  );
}
