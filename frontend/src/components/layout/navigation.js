import {
  BarChart3, CarFront, ClipboardList, FileBadge2,
  LayoutDashboard, ScanLine, Settings2, SlidersHorizontal, Users, Activity, ClipboardCheck, Workflow,
} from 'lucide-react';

/** Permissions remain enforced by the PHP API; this controls navigation only. */
export const NAVIGATION = {
  admin: [
    { key: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { key: 'vehicles', label: 'Vehicles', icon: CarFront },
    { key: 'permits', label: 'Parking permits', icon: FileBadge2 },
    { key: 'slots', label: 'Parking spaces', icon: SlidersHorizontal },
    { key: 'gate', label: 'Gate control', icon: ScanLine },
    { key: 'visits', label: 'Entry & exit log', icon: ClipboardList },
    { key: 'queue', label: 'Queue analytics', icon: Activity },
    { key: 'inspections', label: 'Occupancy inspection', icon: ClipboardCheck },
    { key: 'allocation', label: 'Slot allocation', icon: Workflow },
    { key: 'users', label: 'User management', icon: Users },
    { key: 'reports', label: 'Reports', icon: BarChart3 },
    { key: 'settings', label: 'Settings', icon: Settings2 },
  ],
  guard: [
    { key: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { key: 'gate', label: 'Gate control', icon: ScanLine },
    { key: 'slots', label: 'Parking spaces', icon: SlidersHorizontal },
    { key: 'visits', label: 'Entry & exit log', icon: ClipboardList },
    { key: 'queue', label: 'Queue analytics', icon: Activity },
    { key: 'inspections', label: 'Occupancy inspection', icon: ClipboardCheck },
    { key: 'allocation', label: 'Slot allocation', icon: Workflow },
  ],
  student: [
    { key: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { key: 'vehicles', label: 'My vehicles', icon: CarFront },
    { key: 'permits', label: 'My permits', icon: FileBadge2 },
    { key: 'slots', label: 'Parking availability', icon: SlidersHorizontal },
    { key: 'allocation', label: 'Preferred area', icon: Workflow },
  ],
};

NAVIGATION.faculty = NAVIGATION.student;
