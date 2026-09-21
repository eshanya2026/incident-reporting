import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, User as UserIcon, AlertCircle, Hospital } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res: any = await api.post('/auth/login', { username, password });
      if (res.data?.accessToken && res.data?.user) {
        setAuth(res.data.user, res.data.accessToken);
        navigate('/');
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials or login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogins: Record<string, [string, string]> = {
    staff: ['nurse.mary', 'Staff@123'],
    quality: ['quality.anita', 'Quality@123'],
    hod: ['hod.emergency', 'Hod@123'],
    admin: ['admin', 'Admin@123'],
  };

  const handleQuickLogin = (userType: string) => {
    const [u, pw] = quickLogins[userType];
    setUsername(u);
    setPassword(pw);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 relative overflow-hidden text-[#172033]">
      {/* Subtle soft red background ambient glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#FDECEC]/60 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#FDECEC]/40 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full bg-white rounded-2xl shadow-card border border-[#E2E8F0] overflow-hidden relative z-10">
        {/* Header - Clean White with Red Brand Accent */}
        <div className="bg-white px-8 pt-8 pb-6 text-center border-b border-[#E2E8F0]">
          <div className="w-14 h-14 bg-gradient-to-br from-[#8B1E23] via-[#C62828] to-[#E53935] text-white rounded-2xl mx-auto flex items-center justify-center mb-3.5 shadow-md shadow-red-900/20 ring-1 ring-white/30 relative overflow-hidden">
            <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none"></span>
            <ShieldCheck className="w-8 h-8 text-white relative z-10" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#68151A]">Adhiparasakthi Hospitals</h1>
          <p className="text-xs text-[#64748B] mt-1 uppercase tracking-[0.5px] font-medium">
            Incident Reporting & Patient Safety Portal
          </p>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-5">
          {error && (
            <div className="p-3.5 bg-[#FFF5F5] border border-[#FDECEC] text-[#C62828] rounded-xl text-sm flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-[#C62828]" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#172033] uppercase tracking-wide mb-1.5">
              Username / Employee ID
            </label>
            <div className="relative">
              <UserIcon className="w-4.5 h-4.5 text-[#94A3B8] absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. nurse.mary or quality.anita"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#172033] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#8B1E23]/20 focus:border-[#8B1E23] transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#172033] uppercase tracking-wide mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4.5 h-4.5 text-[#94A3B8] absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#172033] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#8B1E23]/20 focus:border-[#8B1E23] transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-[#8B1E23] via-[#C62828] to-[#E53935] hover:brightness-110 active:scale-[0.99] text-white font-semibold rounded-xl shadow-button-red transition duration-180 flex items-center justify-center space-x-2 relative overflow-hidden cursor-pointer"
          >
            <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent pointer-events-none"></span>
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <span className="tracking-wide relative z-10 font-medium">Sign In to Safety Portal</span>
            )}
          </button>

          <div className="pt-4 border-t border-[#F1F5F9]">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2.5 text-center">
              Quick Demo Login Presets
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('staff')}
                className="px-3 py-2 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl text-[#172033] text-left font-medium transition cursor-pointer"
              >
                🏥 <span>Staff</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('quality')}
                className="px-3 py-2 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl text-[#172033] text-left font-medium transition cursor-pointer"
              >
                🛡️ <span>Quality</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('hod')}
                className="px-3 py-2 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl text-[#172033] text-left font-medium transition cursor-pointer"
              >
                🩺 <span>Dept HOD</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="px-3 py-2 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl text-[#172033] text-left font-medium transition cursor-pointer"
              >
                ⚙️ <span>Admin</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
