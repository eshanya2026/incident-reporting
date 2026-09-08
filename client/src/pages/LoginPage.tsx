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
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials or login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (userType: string) => {
    if (userType === 'admin') {
      setUsername('admin');
      setPassword('Admin@123');
    } else if (userType === 'quality') {
      setUsername('quality.admin');
      setPassword('Quality@123');
    } else if (userType === 'hod') {
      setUsername('hod.emergency');
      setPassword('Hod@123');
    } else if (userType === 'staff') {
      setUsername('nurse.mary');
      setPassword('Staff@123');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 bg-gradient-to-br from-hospital-950 via-slate-900 to-hospital-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-slate-700/30">
        <div className="bg-hospital-900 px-8 py-8 text-white text-center relative overflow-hidden">
          <div className="absolute -right-8 -top-8 opacity-10 text-white">
            <Hospital className="w-48 h-48" />
          </div>
          <div className="w-16 h-16 bg-hospital-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg ring-4 ring-hospital-500/30">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Adhiparasakthi Hospitals</h1>
          <p className="text-xs text-hospital-200 mt-1 uppercase tracking-wider font-semibold">
            Incident Reporting & Patient Safety Portal
          </p>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Username / Employee ID
            </label>
            <div className="relative">
              <UserIcon className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. nurse.mary or admin"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hospital-500 focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hospital-500 focus:bg-white transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-hospital-600 hover:bg-hospital-700 active:bg-hospital-800 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <span>Sign In to Safety Portal</span>
            )}
          </button>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
              Quick Demo Login Presets
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('staff')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-left font-medium"
              >
                🏥 Staff Nurse
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('hod')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-left font-medium"
              >
                🩺 Dept HOD
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('quality')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-left font-medium"
              >
                🛡️ Quality Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-left font-medium"
              >
                ⚡ System Admin
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
