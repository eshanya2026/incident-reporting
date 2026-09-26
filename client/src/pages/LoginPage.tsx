import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Info, Check } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import StatlogLogo from '../components/ui/StatlogLogo';

const REMEMBER_KEY = 'incident-portal:remembered-username';

const readRemembered = () => {
  try {
    return localStorage.getItem(REMEMBER_KEY) || '';
  } catch {
    return '';
  }
};

/** Stagger delay for the .animate-fade-* classes. */
const delay = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties;

export default function LoginPage() {
  const [username, setUsername] = useState(readRemembered);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => !!readRemembered());
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const res: any = await api.post('/auth/login', { username, password });
      if (res.data?.accessToken && res.data?.user) {
        try {
          if (remember) localStorage.setItem(REMEMBER_KEY, username);
          else localStorage.removeItem(REMEMBER_KEY);
        } catch {
          /* storage unavailable — ignore */
        }
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

  const presets = [
    { key: 'staff', label: 'Staff' },
    { key: 'quality', label: 'Quality' },
    { key: 'hod', label: 'Dept HOD' },
    { key: 'admin', label: 'Admin' },
  ];

  const inputClass =
    'w-full px-4 py-3.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#172033] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#8B1E23]/20 focus:border-[#8B1E23] transition';

  return (
    <div className="min-h-screen bg-white p-3 sm:p-5 text-[#172033]">
      {/* Full-screen brand panel */}
      <div className="relative min-h-[calc(100vh-1.5rem)] sm:min-h-[calc(100vh-2.5rem)] rounded-3xl brand-gradient shadow-[0_24px_50px_-20px_rgba(104,21,26,0.55)] overflow-hidden flex flex-col lg:flex-row lg:items-center lg:justify-center lg:gap-12 xl:gap-20 lg:px-10">
        {/* Decorative circles */}
        <div className="animate-fade-in absolute -top-[30%] right-[8%] w-[55vw] max-w-[820px] aspect-square rounded-full bg-white/[0.06] pointer-events-none"></div>
        <div className="animate-fade-in absolute -bottom-[38%] -left-[8%] w-[46vw] min-w-[320px] max-w-[760px] aspect-square rounded-full bg-gradient-to-br from-[#E53935]/50 via-[#A8252C]/60 to-[#3D0A0D]/70 shadow-[0_0_80px_rgba(0,0,0,0.15)] pointer-events-none"></div>

        {/* Welcome copy */}
        <div className="relative z-10 text-white px-8 pt-14 pb-6 sm:px-14 lg:p-0 lg:w-[42%] lg:max-w-[520px]">
          {/* Logo on a light plate so the red artwork stays legible on the red panel */}
          <div
            style={delay(150)}
            className="animate-fade-in-up inline-block bg-gradient-to-br from-white to-[#FFF5F5] rounded-2xl p-3 sm:p-3.5 shadow-[0_12px_30px_-10px_rgba(61,10,13,0.5)] ring-1 ring-white/60"
          >
            <img
              src="/logo.png"
              alt="Adhiparasakthi Hospital"
              className="block w-36 sm:w-40 xl:w-48 h-auto"
            />
          </div>

        
          <div style={delay(420)} className="animate-fade-in-up mt-5">
            <StatlogLogo tone="dark" delay={900} className="text-4xl sm:text-5xl xl:text-6xl" />
          </div>
          <p
            style={delay(540)}
            className="animate-fade-in-up mt-4 text-sm xl:text-base text-white/85 leading-relaxed max-w-md"
          >
            Adhiparasakthi Hospitals&rsquo; incident reporting &amp; patient safety portal. Sign in to
            report, review and resolve incidents &mdash; every report you raise makes care better for the
            next patient.
          </p>
        </div>

        {/* Sign-in card */}
        <div className="relative z-10 px-4 pb-8 sm:px-14 lg:p-0 lg:w-[44%] lg:max-w-[560px] lg:min-w-[420px]">
          <div
            style={delay(250)}
            className="animate-fade-in-up bg-white rounded-3xl shadow-[0_24px_60px_-15px_rgba(15,23,42,0.4)] px-7 py-9 sm:px-10 sm:py-11 xl:px-12 xl:py-14"
          >
            <h2
              style={delay(500)}
              className="animate-fade-in-up text-3xl xl:text-4xl font-extrabold tracking-wide text-[#68151A]"
            >
              Sign in
            </h2>
            <p style={delay(580)} className="animate-fade-in-up text-xs xl:text-sm text-[#64748B] mt-2">
              Use your username or employee ID to access Statlog.
            </p>

            <form onSubmit={handleLogin} className="mt-7 space-y-4">
              {error && (
                <div className="p-3 bg-[#FFF5F5] border border-[#FDECEC] text-[#C62828] rounded-xl text-sm flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}
              {info && (
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] text-[#172033] rounded-xl text-sm flex items-center space-x-2">
                  <Info className="w-5 h-5 shrink-0 text-[#8B1E23]" />
                  <span className="font-medium">{info}</span>
                </div>
              )}

              <input
                type="text"
                required
                aria-label="User name"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="User Name"
                className={`${inputClass} animate-fade-in-up`}
                style={delay(660)}
              />

              <div className="relative animate-fade-in-up" style={delay(740)}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  aria-label="Password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className={`${inputClass} pr-20`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[12.5px] font-bold tracking-wide text-[#68151A] hover:text-[#C62828] transition cursor-pointer"
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>

              <div
                style={delay(820)}
                className="animate-fade-in-up flex items-center justify-between text-xs"
              >
                <label className="flex items-center gap-2 cursor-pointer select-none text-[#172033]">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="sr-only peer"
                  />
                  <span className="w-4 h-4 rounded-[4px] border border-[#94A3B8] bg-white flex items-center justify-center peer-checked:bg-[#8B1E23] peer-checked:border-[#8B1E23] peer-focus-visible:ring-2 peer-focus-visible:ring-[#8B1E23]/30 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </span>
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setInfo('Please contact the system administrator to reset your password.');
                  }}
                  className="text-[#172033] hover:text-[#C62828] transition cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={delay(900)}
                className="animate-fade-in-up w-full py-3.5 bg-gradient-to-r from-[#8B1E23] via-[#C62828] to-[#E53935] hover:brightness-110 active:scale-[0.99] disabled:opacity-70 text-white font-bold rounded-xl shadow-button-red transition duration-180 flex items-center justify-center relative overflow-hidden cursor-pointer"
              >
                <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent pointer-events-none"></span>
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <span className="tracking-wide relative z-10">Sign in</span>
                )}
              </button>
            </form>

            <div
              style={delay(980)}
              className="animate-fade-in-up mt-8 flex flex-wrap items-center gap-x-2 gap-y-2 text-[12.5px] text-[#64748B]"
            >
              <span>Demo login:</span>
              {presets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handleQuickLogin(p.key)}
                  className="px-2.5 py-1 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#FDECEC] hover:border-[#F8B4B4] hover:text-[#68151A] font-semibold transition cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p style={delay(1060)} className="animate-fade-in-up mt-4 text-[12.5px] text-[#64748B]">
              Don&rsquo;t have an account?{' '}
              <span className="font-semibold text-[#68151A]">Contact your administrator</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
