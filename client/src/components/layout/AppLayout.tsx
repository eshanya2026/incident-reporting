import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  FileSpreadsheet,
  CheckSquare,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  User as UserIcon,
  Check,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Inbox, ClipboardCheck, Building2 } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';
import { hasAnyPermission, hasPermission } from '../../lib/rbac';
import StatlogLogo from '../ui/StatlogLogo';

dayjs.extend(relativeTime);

export default function AppLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Close the notification menu when clicking anywhere else
  useEffect(() => {
    if (!showNotifications) return;
    const close = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showNotifications]);

  // Waiting work per role, shown as counts in the navigation (refreshed every minute)
  const { data: countsData } = useQuery({
    queryKey: ['queue-counts', user?.id],
    enabled: Boolean(user),
    refetchInterval: 60_000,
    queryFn: async () => {
      const count = async (url: string, params?: any, filter?: (i: any) => boolean) => {
        try {
          const res: any = await api.get(url, { params });
          const list: any[] = res?.data || [];
          return filter ? list.filter(filter).length : list.length;
        } catch {
          return 0;
        }
      };
      return {
        triage: hasPermission(user, 'incident.triage') ? await count('/incidents/triage-queue') : 0,
        review: hasPermission(user, 'incident.review') ? await count('/incidents/review-queue') : 0,
        department: hasPermission(user, 'incident.read_assigned')
          ? await count('/incidents/my-department', undefined, (i) => ['ASSIGNED', 'UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS'].includes(i.status))
          : 0,
        myReports: hasPermission(user, 'incident.read_own')
          ? await count('/incidents', { mine: true, status: 'INFO_REQUESTED', limit: 200 })
          : 0,
      };
    },
  });
  const queueCounts = countsData ?? { triage: 0, review: 0, department: 0, myReports: 0 };

  const fetchNotifications = async () => {
    try {
      const res: any = await api.get('/notifications');
      if (res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      // Ignore if unauthenticated
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  /** Opens the incident a notification is about and marks it read. */
  const openNotification = async (n: any) => {
    setShowNotifications(false);
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      api.patch(`/notifications/${n._id}/read`).catch(() => undefined);
    }
    if (n.entityType === 'INCIDENT' && n.entityId) {
      // The incident may have moved on since the notification; load fresh data
      queryClient.invalidateQueries({ queryKey: ['incident', n.entityId] });
      navigate(`/incidents/${n.entityId}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      // Ignore
    }
  };

  // Items appear only for users with the permission (see lib/rbac.ts); counts show waiting work
  const navItems: Array<{
    label: string;
    path: string;
    icon: any;
    permission?: string;
    anyPermissions?: string[];
    count?: number;
  }> = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
    { label: 'Report Incident', path: '/incidents/new', icon: PlusCircle, permission: 'incident.create' },
    { label: 'My Reports', path: '/my-reports', icon: FileText, permission: 'incident.read_own', count: queueCounts.myReports },
    { label: 'Triage Inbox', path: '/triage', icon: Inbox, permission: 'incident.triage', count: queueCounts.triage },
    { label: 'Review Queue', path: '/review', icon: ClipboardCheck, permission: 'incident.review', count: queueCounts.review },
    { label: "My Department's Incidents", path: '/my-department', icon: Building2, permission: 'incident.read_assigned', count: queueCounts.department },
    { label: 'All Incidents', path: '/incidents', icon: FileSpreadsheet, permission: 'incident.read_all' },
    { label: 'CAPA', path: '/capas', icon: CheckSquare, permission: 'capa.read' },
    { label: 'Reports', path: '/reports', icon: BarChart3, anyPermissions: ['report.view_all', 'report.view_department'] },
    { label: 'Administration', path: '/admin', icon: Settings, permission: 'admin.user_manage' },
  ];

  const visibleNavItems = navItems.filter((item) => {
    if (item.permission) return hasPermission(user, item.permission);
    if (item.anyPermissions) return hasAnyPermission(user, item.anyPermissions);
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-[#172033]">
      {/* Top Header Bar */}
      <header className="bg-white/95 backdrop-blur border-b border-[#E9DFE0] shadow-[0_4px_18px_-8px_rgba(104,21,26,0.18)] sticky top-0 z-40">
        {/* Brand accent strip */}
        <div className="h-[3px] brand-gradient"></div>

        <div className="w-full px-4 sm:px-6 lg:px-8 h-[68px] sm:h-[76px] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 sm:gap-4 group min-w-0 flex-1 mr-2">
            <img
              src="/logo.png"
              alt="Adhiparasakthi Hospital"
              className="h-10 sm:h-[52px] w-auto shrink-0 transition-transform duration-200 group-hover:scale-105"
            />
            <span
              className="hidden sm:block h-10 w-px bg-gradient-to-b from-transparent via-[#D9C7C8] to-transparent shrink-0"
              aria-hidden="true"
            ></span>
            <div className="min-w-0 flex flex-col gap-1.5">
              <h1 className="leading-none">
                <StatlogLogo className="text-[22px] sm:text-[26px]" />
              </h1>
              <p className="hidden sm:flex items-center gap-1.5 text-[11.5px] text-[#64748B] uppercase tracking-[0.14em] font-semibold truncate">
                <span>Incident Reporting</span>
                <span className="w-1 h-1 rounded-full bg-[#C62828]/60 shrink-0"></span>
                <span>Patient Safety</span>
              </p>
            </div>
          </Link>

          {/* Right Header Navigation & Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Notification Bell */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => {
                  if (!showNotifications) fetchNotifications();
                  setShowNotifications(!showNotifications);
                }}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center relative transition duration-180 cursor-pointer ${
                  showNotifications
                    ? 'bg-[#FDECEC] border-[#F8B4B4] text-[#8B1E23]'
                    : 'bg-white hover:bg-[#FFF5F5] border-[#E2E8F0] hover:border-[#F8B4B4] text-[#64748B] hover:text-[#8B1E23]'
                }`}
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-gradient-to-br from-[#E53935] to-[#B71C1C] text-white text-[11.5px] font-bold flex items-center justify-center ring-2 ring-white shadow-sm">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="fixed left-4 right-4 top-[4.5rem] sm:absolute sm:left-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[22rem] sm:max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-[#E2E8F0] z-50 text-[#172033] overflow-hidden">
                  <div className="px-4 py-3 bg-[#FFF5F5] border-b border-[#FDECEC] flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-[#8B1E23]">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-[#8B1E23] hover:text-[#68151A] font-semibold hover:underline flex items-center space-x-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 text-[#159A68]" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-[#F1F5F9]">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[#64748B]">No recent notifications</div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n._id}
                          type="button"
                          onClick={() => openNotification(n)}
                          className={`w-full text-left p-3.5 text-xs transition cursor-pointer hover:bg-[#F8FAFC] ${n.read ? 'bg-white' : 'bg-[#FFF5F5]/60 border-l-4 border-[#C62828] font-medium'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-[#172033]">{n.title}</span>
                            <span className="text-[11.5px] text-[#94A3B8] whitespace-nowrap">{dayjs(n.createdAt).fromNow()}</span>
                          </div>
                          <div className="text-[#64748B] mt-0.5">{n.message}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Capsule */}
            <div className="flex items-center gap-2.5 bg-white pl-1.5 pr-3 sm:pr-4 h-10 rounded-xl border border-[#E2E8F0]">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8B1E23] to-[#E53935] text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                {user?.name?.charAt(0) || <UserIcon className="w-4 h-4" />}
              </div>
              <div className="hidden sm:flex flex-col items-start gap-0.5 text-left">
                <div className="text-xs font-bold leading-none text-[#172033]">{user?.name || 'User'}</div>
                <div className="text-[11px] leading-none px-1.5 py-[3px] rounded-full bg-[#FDECEC] text-[#8B1E23] font-bold uppercase tracking-wider">
                  {user?.roles?.[0]?.replace(/_/g, ' ') || 'User'}
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="h-10 px-3 sm:px-3.5 rounded-xl bg-white hover:bg-[#FFF5F5] text-[#64748B] hover:text-[#C62828] border border-[#E2E8F0] hover:border-[#F8B4B4] transition duration-180 cursor-pointer flex items-center gap-2 text-xs font-semibold"
              title="Logout"
            >
              <LogOut className="w-[18px] h-[18px]" />
              <span className="hidden lg:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Navigation Bar - soft tinted tray with pill items */}
        <div className="bg-gradient-to-b from-[#FBF6F6] to-[#F8F4F4] border-t border-[#F1E7E8]">
          <div className="w-full px-4 sm:px-6 lg:px-8 flex justify-start md:justify-center gap-1.5 py-2 overflow-x-auto scrollbar-none">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group/nav flex items-center gap-2 h-9 px-4 text-[14px] whitespace-nowrap rounded-full transition duration-180 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#8B1E23] via-[#C62828] to-[#E53935] text-white font-semibold shadow-[0_6px_14px_-4px_rgba(139,30,35,0.55)] relative overflow-hidden'
                      : 'text-[#475569] font-medium hover:text-[#68151A] hover:bg-white hover:shadow-[0_2px_8px_-2px_rgba(104,21,26,0.18)]'
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none"></span>
                  )}
                  <Icon
                    className={`w-4 h-4 relative z-10 transition-colors ${
                      isActive ? 'text-white' : 'text-[#94A3B8] group-hover/nav:text-[#C62828]'
                    }`}
                  />
                  <span className="relative z-10">{item.label}</span>
                  {Boolean(item.count) && (
                    <span
                      className={`relative z-10 min-w-[18px] px-1.5 py-0.5 rounded-full text-[11.5px] font-bold text-center ${
                        isActive ? 'bg-white text-[#8B1E23]' : 'bg-[#8B1E23] text-white'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-7">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E2E8F0] py-4">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#64748B] gap-2">
          <span>Statlog © 2026 – Adhiparasakthi Hospitals Patient Safety & Incident Reporting</span>
          <div className="flex items-center space-x-4 text-[12.5px] text-[#94A3B8]">
            <span>Privacy</span>
            <span>•</span>
            <span>Help Center</span>
            <span>•</span>
            <span>Version 1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
