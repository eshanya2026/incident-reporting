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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="bg-hospital-900 text-white shadow-md sticky top-0 z-40 border-b border-hospital-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-hospital-600 flex items-center justify-center font-extrabold text-white text-base shadow-inner ring-2 ring-hospital-400/30">
              APH
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight tracking-tight">Adhiparasakthi Hospitals</h1>
              <p className="text-[11px] text-hospital-200 uppercase tracking-wide font-medium">
                Incident Reporting & Safety Portal
              </p>
            </div>
          </Link>

          {/* Right Header Navigation & Actions */}
          <div className="flex items-center space-x-4">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-lg bg-hospital-800 hover:bg-hospital-700 text-hospital-100 relative transition"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 text-slate-800 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-600">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-hospital-600 font-semibold hover:underline flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">No recent notifications</div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n._id}
                          className={`p-3.5 text-xs transition ${n.read ? 'bg-white' : 'bg-blue-50/60 font-medium'}`}
                        >
                          <div className="font-bold text-slate-800">{n.title}</div>
                          <div className="text-slate-600 mt-0.5">{n.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Capsule */}
            <div className="flex items-center space-x-3 bg-hospital-800/80 px-3 py-1.5 rounded-full border border-hospital-700">
              <div className="w-7 h-7 rounded-full bg-hospital-600 text-white flex items-center justify-center font-bold text-xs">
                {user?.name?.charAt(0) || <UserIcon className="w-4 h-4" />}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold leading-tight">{user?.name || 'User'}</div>
                <div className="text-[10px] text-hospital-200">{user?.roles?.[0] || 'Staff'}</div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="p-2 rounded-lg bg-hospital-800 hover:bg-red-600 text-hospital-100 transition"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Secondary Sub-Navigation Header */}
        <div className="bg-hospital-950 border-t border-hospital-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 overflow-x-auto scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition ${
                    isActive
                      ? 'border-hospital-400 text-white bg-hospital-900/60'
                      : 'border-transparent text-hospital-300 hover:text-white hover:bg-hospital-900/30'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-hospital-400' : 'text-hospital-400/70'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Adhiparasakthi Hospitals © 2026 – Patient Safety & Incident Reporting System
      </footer>
    </div>
  );
}
