import React, { useState, useEffect } from 'react';
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
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';

export default function AppLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

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

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      // Ignore
    }
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Report Incident', path: '/incidents/new', icon: PlusCircle },
    { label: 'Incident Register', path: '/incidents', icon: FileSpreadsheet },
    { label: 'CAPA Manager', path: '/capas', icon: CheckSquare },
    { label: 'Quality Reports', path: '/reports', icon: BarChart3 },
    { label: 'Master Admin', path: '/admin', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-[#172033]">
      {/* Top Header Bar - Premium White */}
      <header className="bg-white border-b border-[#E2E8F0] shadow-[0_1px_3px_rgba(15,23,42,0.03)] sticky top-0 z-40">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center space-x-3.5 group">
            {/* APH Logo with subtle glossy gradient */}
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#8B1E23] via-[#C62828] to-[#E53935] flex items-center justify-center font-black text-white text-base shadow-md shadow-red-900/20 ring-1 ring-white/30 relative overflow-hidden transition-all duration-200 group-hover:scale-105">
              <span className="relative z-10 tracking-tight">APH</span>
              <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none"></span>
            </div>
            <div>
              <h1 className="font-bold text-[20px] sm:text-[22px] leading-tight tracking-tight text-[#68151A]">
                Adhiparasakthi Hospitals
              </h1>
              <p className="text-[11px] sm:text-[12px] text-[#64748B] uppercase tracking-[0.5px] font-medium mt-0.5">
                Incident Reporting & Safety Portal
              </p>
            </div>
          </Link>

          {/* Right Header Navigation & Actions */}
          <div className="flex items-center space-x-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 rounded-xl bg-white hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#8B1E23] border border-[#E2E8F0] shadow-xs relative transition duration-180 cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#C62828] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-84 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] z-50 text-[#172033] overflow-hidden">
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
                        <div
                          key={n._id}
                          className={`p-3.5 text-xs transition ${n.read ? 'bg-white' : 'bg-[#FFF5F5]/60 border-l-4 border-[#C62828] font-medium'}`}
                        >
                          <div className="font-semibold text-[#172033]">{n.title}</div>
                          <div className="text-[#64748B] mt-0.5">{n.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Capsule */}
            <div className="flex items-center space-x-3 bg-white px-3.5 py-1.5 rounded-xl border border-[#E2E8F0] shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-[#FDECEC] text-[#8B1E23] flex items-center justify-center font-bold text-xs">
                {user?.name?.charAt(0) || <UserIcon className="w-4 h-4" />}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold leading-tight text-[#172033]">{user?.name || 'User'}</div>
                <div className="text-[10px] text-[#64748B] font-medium uppercase">{user?.roles?.[0]?.replace(/_/g, ' ') || 'Staff'}</div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="p-2.5 rounded-xl bg-white hover:bg-[#FFF5F5] text-[#64748B] hover:text-[#C62828] border border-[#E2E8F0] shadow-xs transition duration-180 cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Navigation Bar - Clean White Background */}
        <div className="bg-white border-t border-[#F1F5F9]">
          <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 py-2 overflow-x-auto scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.path === '/incidents/new'
                  ? location.pathname === '/incidents/new'
                  : item.path === '/incidents'
                  ? location.pathname === '/incidents' || (location.pathname.startsWith('/incidents/') && location.pathname !== '/incidents/new')
                  : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-2 text-xs font-medium whitespace-nowrap rounded-xl transition duration-180 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#8B1E23] via-[#C62828] to-[#E53935] text-white font-semibold shadow-md shadow-red-900/15 relative overflow-hidden'
                      : 'text-[#475569] hover:text-[#172033] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent pointer-events-none"></span>
                  )}
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#8B1E23]'}`} />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-[1536px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-7">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E2E8F0] py-4">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#64748B] gap-2">
          <span>Adhiparasakthi Hospitals © 2026 – Patient Safety & Incident Reporting System</span>
          <div className="flex items-center space-x-4 text-[11px] text-[#94A3B8]">
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
