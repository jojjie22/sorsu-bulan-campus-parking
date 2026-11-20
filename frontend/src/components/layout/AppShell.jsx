import React, { useState } from 'react';
import { CarFront } from 'lucide-react';
import { NAVIGATION } from './navigation.js';
import { useAuthSession } from '../../hooks/useAuthSession.js';
import { useNotification } from '../../hooks/useNotification.js';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import Toast from '../../ui/Toast.jsx';
import AuthPage from '../../pages/AuthPage.jsx';
import DashboardPage from '../../pages/DashboardPage.jsx';
import VehiclesPage from '../../pages/VehiclesPage.jsx';
import PermitsPage from '../../pages/PermitsPage.jsx';
import SlotsPage from '../../pages/SlotsPage.jsx';
import GatePage from '../../pages/GatePage.jsx';
import VisitsPage from '../../pages/VisitsPage.jsx';
import UsersPage from '../../pages/UsersPage.jsx';
import ReportsPage from '../../pages/ReportsPage.jsx';
import SettingsPage from '../../pages/SettingsPage.jsx';
import QueueAnalyticsPage from '../../pages/QueueAnalyticsPage.jsx';
import InspectionPage from '../../pages/InspectionPage.jsx';
import AllocationPage from '../../pages/AllocationPage.jsx';

// A single page registry keeps routing decisions out of the layout markup.
const PAGE_COMPONENTS = {
  dashboard: DashboardPage,
  vehicles: VehiclesPage,
  permits: PermitsPage,
  slots: SlotsPage,
  gate: GatePage,
  visits: VisitsPage,
  users: UsersPage,
  reports: ReportsPage,
  settings: SettingsPage,
  queue: QueueAnalyticsPage,
  inspections: InspectionPage,
  allocation: AllocationPage,
};

export default function AppShell() {
  const { user, loading, signIn, signOut } = useAuthSession();
  const { toast, notify, dismiss } = useNotification();
  const [page, setPage] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="boot" role="status">
        <span className="brand-icon"><CarFront size={24}/></span>
        <p>Opening your workspace…</p>
      </div>
    );
  }

  if (!user) return <AuthPage onLogin={signIn} notify={notify}/>;

  const items = NAVIGATION[user.role] || NAVIGATION.student;
  const allowedPage = items.some(item => item.key === page) ? page : 'dashboard';
  const CurrentPage = PAGE_COMPONENTS[allowedPage];
  const title = items.find(item => item.key === allowedPage)?.label || 'Overview';

  return (
    <div className="shell">
      <Sidebar
        user={user}
        items={items}
        currentPage={allowedPage}
        onNavigate={setPage}
        onSignOut={signOut}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
      {mobileMenuOpen && <button className="menu-overlay" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)}/>}
      <div className="content">
        <Topbar user={user} title={title} onOpenMenu={() => setMobileMenuOpen(true)}/>
        <main className="main" key={`${allowedPage}:${user.role}`}>
          <CurrentPage user={user} notify={notify} navigate={setPage}/>
        </main>
        <footer className="app-footer"><span>CampusPark Operations</span><span>Parking management platform</span></footer>
      </div>
      <Toast toast={toast} onClose={dismiss}/>
    </div>
  );
}
