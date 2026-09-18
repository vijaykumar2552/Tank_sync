import {
  LayoutDashboard, BarChart3, BrainCircuit, Droplet, Radio, Power,
  FileBarChart, Bell, ScrollText, Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface RouteConfig {
  path: string;
  label: string;
  icon: LucideIcon;
  group: 'Overview' | 'Hardware & Water' | 'System';
}

export const ROUTES: RouteConfig[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, group: 'Overview' },
  { path: '/ai-insights', label: 'AI Insights', icon: BrainCircuit, group: 'Overview' },
  { path: '/tanks', label: 'Tanks', icon: Droplet, group: 'Hardware & Water' },
  { path: '/devices', label: 'Devices', icon: Radio, group: 'Hardware & Water' },
  { path: '/pump-controls', label: 'Pump Controls', icon: Power, group: 'Hardware & Water' },
  { path: '/reports', label: 'Reports', icon: FileBarChart, group: 'System' },
  { path: '/notifications', label: 'Notifications', icon: Bell, group: 'System' },
  { path: '/audit-logs', label: 'Audit Logs', icon: ScrollText, group: 'System' },
  { path: '/settings', label: 'Settings', icon: Settings, group: 'System' },
];

export const ROUTE_GROUPS: Array<{ label: string; routes: RouteConfig[] }> = [
  { label: 'Overview', routes: ROUTES.filter((r) => r.group === 'Overview') },
  { label: 'Hardware & Water', routes: ROUTES.filter((r) => r.group === 'Hardware & Water') },
  { label: 'System', routes: ROUTES.filter((r) => r.group === 'System') },
];

export function getRouteLabel(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  const route = ROUTES.find((r) => pathname.startsWith(r.path) && r.path !== '/');
  return route?.label ?? 'TankSync';
}
