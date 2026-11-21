import React, { useState } from 'react';
import { Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/useAction';
import { toast } from '../../store/useToastStore';
import { useAuthStore } from '../../store/useAuthStore';

const COMMON_PASSWORD = 'mapims@123';

/** Change your own password (My Profile). Other devices are signed out by the server. */
export function ChangePasswordForm() {
  const user = useAuthStore((s) => s.user);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const ids = [user?.username, user?.employeeId].filter(Boolean).map((v) => String(v).toLowerCase());
  const rules = [
    { ok: next.length >= 8, text: 'At least 8 characters' },
    { ok: Boolean(next) && next !== COMMON_PASSWORD, text: 'Not the password you were first given' },
    { ok: Boolean(next) && !ids.includes(next.toLowerCase()), text: 'Not your Employee ID or username' },
    { ok: Boolean(next) && next !== current, text: 'Different from your current password' },
    { ok: Boolean(confirm) && next === confirm, text: 'Both new passwords match' },
  ];
  const canSubmit = Boolean(current) && rules.every((r) => r.ok) && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      const res: any = await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      const others = res?.data?.otherSessionsEnded ?? 0;
      toast.success(`Your password has been changed${others ? `. Signed out on ${others} other device(s)` : ''}.`);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(errorMessage(err, 'Could not change your password'));
    } finally {
      setSaving(false);
    }
  };

  const input =
    'w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5C1A22]/20 focus:border-[#5C1A22] transition';
  const label = 'block text-[13px] font-semibold text-[#172033] mb-1.5';

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && (
        <div role="alert" className="p-3 bg-[#FAF3EC] border border-[#F4E6D7] text-[#7A2430] rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="cpw-current" className={label}>Current password</label>
          <input id="cpw-current" type={show ? 'text' : 'password'} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="cpw-new" className={label}>New password</label>
          <input id="cpw-new" type={show ? 'text' : 'password'} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="cpw-confirm" className={label}>Confirm new password</label>
          <input id="cpw-confirm" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <ul className="grid gap-1 sm:grid-cols-2 sm:gap-x-6">
          {rules.map((r) => (
            <li key={r.text} className={`flex items-center gap-2 text-[13px] ${r.ok ? 'text-emerald-700' : 'text-[#94A3B8]'}`}>
              <Check className={`w-4 h-4 shrink-0 ${r.ok ? '' : 'opacity-30'}`} /> {r.text}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setShow((s) => !s)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#64748B] hover:text-[#5C1A22] cursor-pointer shrink-0">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {show ? 'Hide passwords' : 'Show passwords'}
        </button>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <p className="text-[12px] text-[#64748B]">You stay signed in here; any other devices signed in to your account will be signed out.</p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#5C1A22] via-[#7A2430] to-[#9C3A42] text-white text-sm font-semibold shadow-button-red disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          {saving ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  );
}
