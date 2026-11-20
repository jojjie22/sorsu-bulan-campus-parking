import React from 'react';
import { ArrowUpRight, LogOut, ShieldCheck, X } from 'lucide-react';
import { cn, roles } from '../../lib/utils.js';

function Brand() {
  return (
    <div className="brand" aria-label="CampusPark home">
      <img className="brand-seal" src="/sorsu-seal.png" alt="" />
      <span className="brand-wordmark">
        <strong>SorSU–Bulan<span> Park</span></strong>
        <small>CAMPUS PARKING SYSTEM</small>
      </span>
    </div>
  );
}

export default function Sidebar({ user, items, currentPage, onNavigate, onSignOut, open, onClose }) {
  const initials = user.full_name.split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase();

  return (
    <aside className={cn('sidebar', open && 'open')} aria-label="Primary navigation">
      <div className="sidebar-brand-row">
        <Brand />
        <button className="icon-button mobile-close" aria-label="Close menu" onClick={onClose}><X size={20}/></button>
      </div>

      <div className="workspace-label"><span className="workspace-line" /> WORKSPACE <span className="workspace-line" /></div>
      <nav className="sidebar-nav" aria-label="Workspace">
        {items.map(({key, label, icon: Icon}) => (
          <button
            key={key}
            type="button"
            className={cn('nav-link', currentPage === key && 'selected')}
            aria-current={currentPage === key ? 'page' : undefined}
            onClick={() => { onNavigate(key); onClose(); }}
          >
            <Icon size={18} strokeWidth={1.9}/>
            <span>{label}</span>
            {currentPage === key && <span className="nav-active-indicator" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-help">
          <ShieldCheck size={19} strokeWidth={1.8}/>
          <div><strong>Campus access</strong><span>Verified parking operations</span></div>
          <ArrowUpRight size={15}/>
        </div>
        <div className="sidebar-account">
          <div className="avatar avatar-sidebar">{initials}</div>
          <div className="sidebar-account-text"><strong>{user.full_name}</strong><small>{roles[user.role]}</small></div>
          <button type="button" aria-label="Sign out" title="Sign out" className="icon-button sidebar-signout" onClick={onSignOut}>
            <LogOut size={18}/>
          </button>
        </div>
      </div>
    </aside>
  );
}
