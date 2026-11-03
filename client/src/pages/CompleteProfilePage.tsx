import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Eye, EyeOff, Loader2, Check, X, LogOut, IdCard } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { errorMessage } from '../lib/useAction';
import { SearchableSelect } from '../components/ui/SearchableSelect';

const COMMON_PASSWORD = 'mapims@123';

/**
 * First sign-in of an imported staff member: confirm department and designation, optionally add a
 * WhatsApp number and email, and set their own password. They then sign in again with it.
 */
export default function CompleteProfilePage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [departmentId, setDepartmentId] = useState(user?.departmentId ?? '');
  const [designation, setDesignation] = useState(user?.designation ?? '');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // The stored user may predate the latest department/designation; take them from the server once
  useEffect(() => {
    api
      .get('/auth/me')
      .then((res: any) => {
        const me = res?.data;
        if (!me) return;
        setDepartmentId((d) => d || me.departmentId || '');
        setDesignation((d) => d || me.designation || '');
        if (me.email) setEmail((e) => e || me.email);
      })
      .catch(() => undefined);
  }, []);

  const { data: deptData, isLoading: deptLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments'),
  });
  const departmentOptions = useMemo(
    () =>
      (((deptData as any)?.data ?? []) as any[])
        .filter((d) => d.active !== false && d.category !== 'Demo & Core Operations')
        .map((d) => ({ value: d._id, label: d.name, group: d.category }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [deptData]
  );

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (!user.mustCompleteProfile) return <Navigate to="/" replace />;

  const rules = [
    { ok: password.length >= 8, text: 'At least 8 characters' },
    {
      ok: Boolean(password) && password !== COMMON_PASSWORD,
      text: 'Not the password you were given',
    },
    {
      ok: Boolean(password) && password.toLowerCase() !== (user.username || '').toLowerCase(),
      text: 'Not your Employee ID',
    },
    {
      ok: Boolean(confirm) && password === confirm,
      text: 'Both passwords match',
    },
  ];
  const whatsappDigits = whatsapp.replace(/\D/g, '').replace(/^0+/, '');
  const whatsappOk = !whatsappDigits || whatsappDigits.length === 10 || (whatsappDigits.length >= 11 && whatsappDigits.length <= 15);
  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = Boolean(departmentId) && designation.trim().length >= 2 && whatsappOk && emailOk && rules.every((r) => r.ok) && !saving;

  const signOut = () => {
    api.post('/auth/logout').catch(() => undefined);
    logout();
    navigate('/login', { replace: true });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSaving(true);
    try {
      const res: any = await api.post('/auth/complete-profile', {
        departmentId,
        designation: designation.trim(),
        whatsappNumber: whatsapp.trim(),
        email: email.trim(),
        newPassword: password,
        confirmPassword: confirm,
      });
      logout();
      navigate('/login', {
        replace: true,
        state: {
          message: res?.message || 'Your details are saved. Please sign in with your new password.',
        },
      });
    } catch (err) {
      setError(errorMessage(err, 'Could not save your details. Please try again.'));
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#172033] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#5C1A22]/20 focus:border-[#5C1A22] transition';
  const label = 'block text-[13px] font-semibold text-[#172033] mb-1.5';
  const hint = 'text-[12px] text-[#64748B] mt-1';

  return (
    <div className="min-h-screen bg-white p-3 sm:p-5 text-[#172033]">
      <div className="relative min-h-[calc(100vh-1.5rem)] sm:min-h-[calc(100vh-2.5rem)] rounded-3xl brand-gradient shadow-[0_24px_50px_-20px_rgba(61,15,22,0.55)] overflow-hidden flex items-start sm:items-center justify-center px-3 py-8 sm:px-8">
        <div className="absolute -top-[30%] right-[8%] w-[55vw] max-w-[820px] aspect-square rounded-full bg-white/[0.06] pointer-events-none"></div>

        <div className="relative z-10 w-full max-w-[640px] bg-white rounded-3xl shadow-[0_24px_60px_-15px_rgba(15,23,42,0.4)] px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#3D0F16]">Welcome, {user.name}</h1>
              <p className="text-sm text-[#64748B] mt-1.5">
                Before you start, please check your details and set your own password. You will then sign in again with the new password.
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#64748B] hover:text-[#5C1A22] cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>

          <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FAF3EC] border border-[#F4E6D7] text-[13px] text-[#5C1A22]">
            <IdCard className="w-4 h-4" /> Employee ID <span className="font-bold">{user.employeeId}</span>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
            {error && (
              <div
                role="alert"
                className="p-3 bg-[#FAF3EC] border border-[#F4E6D7] text-[#7A2430] rounded-xl text-sm flex items-center gap-2"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={label} htmlFor="cp-department">
                  Department <span className="text-[#B5484F]">*</span>
                </label>
                <SearchableSelect
                  id="cp-department"
                  containerClassName="block w-full"
                  className={inputClass + ' text-left'}
                  value={departmentId}
                  onChange={setDepartmentId}
                  options={departmentOptions}
                  placeholder={deptLoading ? 'Loading departments…' : 'Select your department'}
                  searchPlaceholder="Search departments…"
                />
                {!departmentId && !deptLoading && <p className={hint}>Your department was not in our records. Please choose it.</p>}
              </div>

              <div className="sm:col-span-2">
                <label className={label} htmlFor="cp-designation">
                  Designation <span className="text-[#B5484F]">*</span>
                </label>
                <input
                  id="cp-designation"
                  className={inputClass}
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div>
                <label className={label} htmlFor="cp-whatsapp">
                  WhatsApp number <span className="font-normal text-[#94A3B8]">(optional)</span>
                </label>
                <input
                  id="cp-whatsapp"
                  className={`${inputClass} ${whatsappOk ? '' : '!border-red-400'}`}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  inputMode="tel"
                  placeholder="98401 12345"
                  maxLength={20}
                />
                <p className={whatsappOk ? hint : 'text-[12px] text-red-600 mt-1'}>
                  {whatsappOk ? 'To get updates about incidents you report.' : 'Enter a 10-digit mobile number.'}
                </p>
              </div>

              <div>
                <label className={label} htmlFor="cp-email">
                  Email <span className="font-normal text-[#94A3B8]">(optional)</span>
                </label>
                <input
                  id="cp-email"
                  type="email"
                  className={`${inputClass} ${emailOk ? '' : '!border-red-400'}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  maxLength={200}
                />
                {!emailOk && <p className="text-[12px] text-red-600 mt-1">Enter a valid email address.</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-[#F4E6D7] bg-[#FFFCF8] p-4 sm:p-5">
              <h2 className="text-[15px] font-bold text-[#3D0F16]">Set your new password</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="cp-password">
                    New password <span className="text-[#B5484F]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="cp-password"
                      type={showPassword ? 'text' : 'password'}
                      className={`${inputClass} pr-11`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#94A3B8] hover:text-[#5C1A22] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={label} htmlFor="cp-confirm">
                    Confirm password <span className="text-[#B5484F]">*</span>
                  </label>
                  <input
                    id="cp-confirm"
                    type={showPassword ? 'text' : 'password'}
                    className={inputClass}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <ul className="mt-3 grid gap-1 sm:grid-cols-2 text-[12.5px]" aria-label="Password rules">
                {rules.map((r) => (
                  <li key={r.text} className={`flex items-center gap-1.5 ${r.ok ? 'text-emerald-700' : 'text-[#64748B]'}`}>
                    {r.ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-[#CBD5E1]" />}
                    {r.text}
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#5C1A22] via-[#6B1F29] to-[#7A2430] text-white font-bold text-sm shadow-button-red hover:brightness-110 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save and sign in again
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
