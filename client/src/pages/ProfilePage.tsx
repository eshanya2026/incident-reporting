import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserCircle, IdCard, KeyRound, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/useAction';
import { toast } from '../store/useToastStore';
import { Card, Field, PageHeader } from '../components/ui/primitives';
import { WhatsappInput, isValidMobile, toLocalMobile } from '../components/ui/WhatsappInput';
import { ChangePasswordForm } from '../components/layout/ChangePasswordForm';

const ROLE_LABELS: Record<string, string> = {
  STAFF: 'Staff',
  QUALITY: 'Quality',
  HOD: 'Head of Department',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  RCA_HEAD: 'RCA Head',
  INTIMATION_MEMBER: 'Intimation member',
};

/** My Profile: your details, your WhatsApp number and email, and changing your password. */
export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => api.get('/auth/me') });
  const me = (data as any)?.data;

  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!me) return;
    setWhatsapp(me.whatsappNumber ? toLocalMobile(me.whatsappNumber) : '');
    setEmail(me.email || '');
  }, [me]);

  const whatsappOk = isValidMobile(whatsapp);
  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const dirty = Boolean(me) && (whatsapp !== (me.whatsappNumber ? toLocalMobile(me.whatsappNumber) : '') || email.trim() !== (me.email || ''));

  const save = async () => {
    if (!dirty || !whatsappOk || !emailOk) return;
    setSaving(true);
    try {
      const res: any = await api.patch('/auth/me', { whatsappNumber: whatsapp.trim(), email: email.trim() });
      toast.success(res?.message || 'Your details are saved');
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save your details'));
    } finally {
      setSaving(false);
    }
  };

  const input =
    'w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5C1A22]/20 focus:border-[#5C1A22] transition';

  return (
    <div className="space-y-5">
      <PageHeader icon={UserCircle} title="My Profile" description="Your details in the incident reporting system, and your password." />

      {isLoading || !me ? (
        <div className="py-16 flex justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <>
          <Card title="Your details" icon={IdCard}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              <Field label="Name">{me.name}</Field>
              <Field label="Employee ID">{me.employeeId}</Field>
              <Field label="Username">{me.username}</Field>
              <Field label="Role">{(me.roles || []).map((r: string) => ROLE_LABELS[r] || r).join(', ') || '—'}</Field>
              <Field label="Department">{me.department?.name || '—'}</Field>
              <Field label="Designation">{me.designation || '—'}</Field>
            </div>
            <p className="text-xs text-slate-500 mt-4">Name, department, designation and role are kept by the Quality department. Ask them if any of these are wrong.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-5 border-t border-slate-100">
              <div>
                <label htmlFor="pf-whatsapp" className="block text-[13px] font-semibold text-[#172033] mb-1.5">
                  WhatsApp number
                </label>
                <WhatsappInput id="pf-whatsapp" value={whatsapp} onChange={setWhatsapp} className="!rounded-xl" />
                <p className={`text-[12px] mt-1 ${whatsappOk ? 'text-[#64748B]' : 'text-red-600'}`}>
                  {whatsappOk ? 'Incident updates for you are sent to this number.' : 'Enter a 10-digit mobile number.'}
                </p>
              </div>
              <div>
                <label htmlFor="pf-email" className="block text-[13px] font-semibold text-[#172033] mb-1.5">
                  Email <span className="font-normal text-[#94A3B8]">(optional)</span>
                </label>
                <input id="pf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${input} ${emailOk ? '' : '!border-red-400'}`} />
                {!emailOk && <p className="text-[12px] mt-1 text-red-600">Enter a valid email address.</p>}
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={save}
                disabled={!dirty || !whatsappOk || !emailOk || saving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#5C1A22] via-[#7A2430] to-[#9C3A42] text-white text-sm font-semibold shadow-button-red disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </Card>

          <Card title="Change password" icon={KeyRound}>
            <ChangePasswordForm />
          </Card>
        </>
      )}
    </div>
  );
}
