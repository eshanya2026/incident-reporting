import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldAlert,
  Upload,
  CheckCircle2,
  Check,
  User,
  MapPin,
  Tag,
  FileText,
  AlertTriangle,
  X,
  Paperclip,
  Clock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import dayjs from 'dayjs';
import { departmentOptions } from '../components/ui/DepartmentOptions';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { PageHeader } from '../components/ui/primitives';
import { toast } from '../store/useToastStore';
import { errorMessage } from '../lib/useAction';

const FLOORS = ['Ground Floor', 'Floor 1', 'Floor 2', 'Floor 3', 'Floor 4', 'Floor 5'] as const;
const ZONES = ['Zone-1', 'Zone-B', 'Zone-C'] as const;

/** Harm levels: colour is the identity of each level, tint is used for the selected card. */
const SEVERITY_LEVELS = [
  { lvl: 1, name: 'Near Miss', desc: 'No harm', color: '#10B981', tint: '#ECFDF5', label: 'Level 1 – Near Miss (No Harm)', sublabel: 'Incident caught or occurred with zero harm' },
  { lvl: 2, name: 'Minor', desc: 'Minimal harm', color: '#0284C7', tint: '#F0F9FF', label: 'Level 2 – Minor Harm', sublabel: 'Minimal intervention or basic observation required' },
  { lvl: 3, name: 'Moderate', desc: 'Reversible harm', color: '#EA580C', tint: '#FFF7ED', label: 'Level 3 – Moderate Harm', sublabel: 'Reversible harm requiring medical or surgical intervention' },
  { lvl: 4, name: 'Major', desc: 'Severe harm', color: '#DC2626', tint: '#FEF2F2', label: 'Level 4 – Major Harm', sublabel: 'Permanent impairment or prolonged hospital stay' },
  { lvl: 5, name: 'Sentinel', desc: 'Catastrophic', color: '#6B1418', tint: '#FBEEEF', label: 'Level 5 – Critical / Sentinel Event', sublabel: 'Catastrophic event, patient death or permanent severe loss of function' },
] as const;

const inputClass =
  'w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-[#8B1E23]/10 focus:border-[#8B1E23] transition disabled:opacity-50 disabled:bg-slate-50';
const textareaClass =
  'w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-[#8B1E23]/10 focus:border-[#8B1E23] transition resize-y';

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Labelled form field. */
function Field({
  label,
  required,
  hint,
  htmlFor,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-[#C62828] ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Row of tap-to-select chips (used for floor and zone). */
function ChipGroup({
  options,
  value,
  onChange,
  disabled,
  label,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`h-10 px-4 rounded-xl border text-sm font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              active
                ? 'bg-gradient-to-b from-[#C62828] to-[#8B1E23] text-white border-transparent shadow-[0_6px_14px_-6px_rgba(139,30,35,0.7),inset_0_1px_0_rgba(255,255,255,0.25)]'
                : 'bg-white border-slate-200 text-slate-700 hover:border-[#8B1E23]/50 hover:bg-[#FFF5F5] hover:text-[#68151A]'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/** Numbered section card. */
function Section({
  id,
  step,
  icon: Icon,
  title,
  subtitle,
  optional,
  done,
  action,
  children,
}: {
  id: string;
  step: number;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  optional?: boolean;
  done?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-40 bg-white rounded-2xl border border-slate-200 shadow-card"
    >
      <header className="px-5 sm:px-6 py-4 flex items-center gap-4 bg-gradient-to-r from-[#FFF8F8] to-white border-b border-slate-100 rounded-t-2xl">
        <span
          className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-md transition-colors ${
            done ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-gradient-to-br from-[#E53935] to-[#8B1E23] shadow-red-900/25'
          }`}
        >
          {done ? <Check className="w-5 h-5" strokeWidth={3} /> : step}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Icon className="w-4 h-4 text-[#8B1E23] shrink-0" />
            <span>{title}</span>
            {optional && (
              <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                Optional
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        {action}
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export default function ReportIncidentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [incidentDateTime, setIncidentDateTime] = useState(dayjs().format('YYYY-MM-DDTHH:mm'));
  const [departmentId, setDepartmentId] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [locationId, setLocationId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryCode, setSubcategoryCode] = useState('');
  const [patientInvolved, setPatientInvolved] = useState(false);
  const [patient, setPatient] = useState({
    uhid: '',
    ipNumber: '',
    name: '',
    age: '',
    gender: 'Male',
    ward: '',
    bed: '',
  });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [immediateAction, setImmediateAction] = useState('');
  const [severity, setSeverity] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Queries
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments'),
  });

  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get('/locations'),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories'),
  });

  const departments = (departmentsData as any)?.data || [];
  const locations = (locationsData as any)?.data || [];
  const categories = (categoriesData as any)?.data || [];

  const matchingLocations = React.useMemo(() => {
    if (!selectedFloor || !selectedZone) return [];
    return locations.filter((l: any) => l.floor === selectedFloor && l.zone === selectedZone);
  }, [locations, selectedFloor, selectedZone]);

  const selectedLocation = locations.find((l: any) => l._id === locationId);

  const categoryOptions = React.useMemo(() => {
    const hasMultipleDomains = new Set(categories.map((c: any) => c.domain || 'General Categories')).size > 1;
    return categories.map((c: any) => ({
      value: c._id,
      label: c.name,
      group: hasMultipleDomains ? c.domain || 'General Categories' : undefined,
    }));
  }, [categories]);

  const selectedCategory = categories.find((c: any) => c._id === categoryId);
  const subcategories = selectedCategory?.subcategories || [];
  const selectedDepartment = departments.find((d: any) => d._id === departmentId);
  const currentSeverity = SEVERITY_LEVELS[severity - 1];

  // ---- Progress: the seven required fields ----
  const requiredChecks = [
    Boolean(incidentDateTime),
    Boolean(departmentId),
    Boolean(selectedFloor),
    Boolean(selectedZone),
    Boolean(categoryId),
    Boolean(title.trim()),
    Boolean(description.trim()),
  ];
  const requiredDone = requiredChecks.filter(Boolean).length;
  const progress = Math.round((requiredDone / requiredChecks.length) * 100);

  const whereDone = requiredChecks.slice(0, 4).every(Boolean);
  const categoryDone = requiredChecks[4];
  const detailsDone = requiredChecks[5] && requiredChecks[6];
  const patientDone = patientInvolved && Boolean(patient.name.trim() || patient.uhid.trim());
  const evidenceDone = uploadedFiles.length > 0;

  const steps = [
    { id: 'sec-where', label: 'Where & when', done: whereDone, optional: false },
    { id: 'sec-category', label: 'Category & severity', done: categoryDone, optional: false },
    { id: 'sec-patient', label: 'Patient details', done: patientDone, optional: true },
    { id: 'sec-details', label: 'What happened', done: detailsDone, optional: false },
    { id: 'sec-evidence', label: 'Evidence', done: evidenceDone, optional: true },
  ];

  const RING_R = 30;
  const RING_C = 2 * Math.PI * RING_R;

  // ---- Attachments ----
  const uploadSingleFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', 'INCIDENT');

    setUploading(true);
    try {
      const res: any = await api.post('/attachments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data) {
        setUploadedFiles((prev) => [...prev, res.data]);
      }
    } catch (err: any) {
      toast.error(errorMessage(err, 'File upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesArray = Array.from(e.target.files);
    for (const file of filesArray) {
      await uploadSingleFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    const filesArray = Array.from(e.dataTransfer.files);
    for (const file of filesArray) {
      await uploadSingleFile(file);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f._id !== fileId));
  };

  // ---- Location handlers ----
  const handleFloorChange = (f: string) => {
    setSelectedFloor(f);
    setSelectedZone('');
    setLocationId('');
  };

  const handleZoneChange = (z: string) => {
    setSelectedZone(z);
    const matches = locations.filter((l: any) => l.floor === selectedFloor && l.zone === z);
    if (matches.length > 0) {
      const exact = matches.find((m: any) => m.code.startsWith('FL')) || matches[0];
      setLocationId(exact._id);
    } else {
      setLocationId('');
    }
  };

  // ---- Submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!departmentId) return setError('Please select the department where it occurred.');
    if (!selectedFloor) return setError('Please select the hospital floor.');
    if (!selectedZone) return setError('Please select the zone.');
    if (!categoryId) return setError('Please select an incident category.');

    setLoading(true);

    try {
      const payload: any = {
        incidentDateTime,
        occurredInDepartmentId: departmentId,
        locationId,
        floor: selectedFloor || undefined,
        zone: selectedZone || undefined,
        categoryId,
        subcategoryCode: subcategoryCode || undefined,
        patientInvolved,
        title,
        description,
        immediateAction: immediateAction || undefined,
        severity: Number(severity),
        attachments: uploadedFiles.map((f) => f._id),
      };

      if (patientInvolved) {
        payload.patient = {
          uhid: patient.uhid || undefined,
          ipNumber: patient.ipNumber || undefined,
          name: patient.name || undefined,
          age: patient.age ? Number(patient.age) : undefined,
          gender: patient.gender,
          ward: patient.ward || undefined,
          bed: patient.bed || undefined,
        };
      }

      const res: any = await api.post('/incidents', payload);
      if (res.data) {
        setSuccess(`Incident ${res.data.incidentNumber} reported successfully!`);
        setTimeout(() => navigate(`/incidents/${res.data._id}`), 1500);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to submit incident report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-clinicalText-primary">
<<<<<<< HEAD
      {/* Page Title Header - dark theme */}
      <div className="bg-gradient-to-r from-[#241014] via-[#1B0E11] to-[#150A0C] p-6 sm:p-7 rounded-2xl border border-[#3D1B1F] shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
        <h2 className="text-xl font-bold text-white flex items-start space-x-2">
          <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5 text-[#F06B70]" />
          <span>Report Hospital Safety Incident / Near Miss</span>
        </h2>
        <p className="text-xs text-slate-300/80 mt-1">
          Complete the form below to initiate triage, investigation, and safety management.
        </p>
      </div>
=======
      <PageHeader
        icon={ShieldAlert}
        title="Report Safety Incident / Near Miss"
        description="Tell us what happened. Quality reviews every report and routes it to the responsible department."
      >
        <span className="self-start md:self-auto shrink-0 inline-flex items-center gap-2 text-xs font-bold px-4 py-2 bg-black/20 text-[#FBC9CB] rounded-full border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <Clock className="w-4 h-4" />
          Takes under 3 minutes
        </span>
      </PageHeader>
>>>>>>> 78cda57 (production)

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-[290px_minmax(0,1fr)] gap-6 items-start">
        {/* ---------- Progress rail ---------- */}
        <aside className="lg:sticky lg:top-40 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
            <div className="flex items-center gap-4">
              <div className="relative w-[72px] h-[72px] shrink-0">
                <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
                  <circle cx="36" cy="36" r={RING_R} fill="none" stroke="#F1E4E5" strokeWidth="7" />
                  <circle
                    cx="36"
                    cy="36"
                    r={RING_R}
                    fill="none"
                    stroke="url(#ringGrad)"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C * (1 - progress / 100)}
                    className="transition-[stroke-dashoffset] duration-500 ease-out"
                  />
                  <defs>
                    <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#E53935" />
                      <stop offset="100%" stopColor="#8B1E23" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-base font-extrabold text-[#68151A]">
                  {progress}%
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Report progress</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {requiredDone} of {requiredChecks.length} required fields
                </p>
              </div>
            </div>

            <ol className="hidden lg:block mt-5 space-y-1">
              {steps.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(s.id)}
                    className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-[#FFF5F5] transition cursor-pointer"
                  >
                    <span
                      className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                        s.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {s.done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className={`text-sm flex-1 ${s.done ? 'text-slate-900 font-semibold' : 'text-slate-600 font-medium'}`}>
                      {s.label}
                    </span>
                    {s.optional && <span className="text-[11px] text-slate-400">optional</span>}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {/* Live summary */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
            <div className="h-1.5" style={{ background: currentSeverity.color }}></div>
            <div className="p-5 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Live summary</p>
              <div className="flex items-center gap-2.5">
                <span
                  className="w-8 h-8 rounded-lg text-white font-black text-sm flex items-center justify-center shrink-0"
                  style={{ background: currentSeverity.color }}
                >
                  {severity}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 leading-tight">{currentSeverity.name}</p>
                  <p className="text-xs text-slate-500">{currentSeverity.desc}</p>
                </div>
              </div>
              <dl className="text-xs space-y-2 pt-1">
                <div className="flex gap-2">
                  <dt className="text-slate-400 w-16 shrink-0">Location</dt>
                  <dd className="text-slate-700 font-medium min-w-0">
                    {selectedFloor ? `${selectedFloor}${selectedZone ? ` • ${selectedZone}` : ''}` : '—'}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-400 w-16 shrink-0">Dept.</dt>
                  <dd className="text-slate-700 font-medium min-w-0 truncate">{selectedDepartment?.name || '—'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-400 w-16 shrink-0">Category</dt>
                  <dd className="text-slate-700 font-medium min-w-0">{selectedCategory?.name || '—'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-400 w-16 shrink-0">Files</dt>
                  <dd className="text-slate-700 font-medium">{uploadedFiles.length}</dd>
                </div>
              </dl>
            </div>
          </div>
        </aside>

        {/* ---------- Form sections ---------- */}
        <div className="space-y-5 min-w-0">
          {/* 1. Where & when */}
          <Section
            id="sec-where"
            step={1}
            icon={MapPin}
            title="Where & when"
            subtitle="When it happened and the exact place in the hospital."
            done={whereDone}
          >
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Date & time of incident" required htmlFor="incident-datetime">
                <input
                  id="incident-datetime"
                  type="datetime-local"
                  required
                  value={incidentDateTime}
                  onChange={(e) => setIncidentDateTime(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Department where it occurred" required>
                <SearchableSelect
                  value={departmentId}
                  onChange={setDepartmentId}
                  containerClassName="block w-full"
                  options={[
                    { value: '', label: 'Select department' },
                    ...departmentOptions(departments, (d) => `${d.name} (${d.code})`),
                  ]}
                  searchPlaceholder="Search departments..."
                  className={inputClass}
                />
              </Field>

              <Field label="Hospital floor" required className="sm:col-span-2">
                <ChipGroup label="Hospital floor" options={FLOORS} value={selectedFloor} onChange={handleFloorChange} />
              </Field>

              <Field
                label="Zone"
                required
                className="sm:col-span-2"
                hint={!selectedFloor ? 'Select a floor first.' : undefined}
              >
                <ChipGroup
                  label="Zone"
                  options={ZONES}
                  value={selectedZone}
                  onChange={handleZoneChange}
                  disabled={!selectedFloor}
                />
              </Field>

              {selectedFloor && selectedZone && matchingLocations.length > 1 && (
                <Field
                  label={`Specific room / ward / bay in ${selectedFloor} • ${selectedZone}`}
                  className="sm:col-span-2"
                  hint="Optional — pick a more precise place if you know it."
                >
                  <SearchableSelect
                    value={locationId}
                    onChange={setLocationId}
                    containerClassName="block w-full"
                    options={matchingLocations.map((l: any) => ({
                      value: l._id,
                      label: `${l.name} ${l.type ? `[${l.type}]` : ''}`.trim(),
                    }))}
                    searchPlaceholder="Search rooms..."
                    className={inputClass}
                  />
                </Field>
              )}

              {selectedFloor && selectedZone && (
                <div className="sm:col-span-2 flex items-center gap-2.5 text-sm text-[#68151A] bg-[#FFF5F5] px-4 py-3 rounded-xl border border-[#FBD5D5] animate-tab-panel-in">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>
                    Incident location: <strong>{selectedFloor}</strong> &bull; <strong>{selectedZone}</strong>
                    {selectedLocation && !selectedLocation.code.startsWith('FL') ? ` (${selectedLocation.name})` : ''}
                  </span>
                </div>
              )}
            </div>
          </Section>

          {/* 2. Category & severity */}
          <Section
            id="sec-category"
            step={2}
            icon={Tag}
            title="Category & severity"
            subtitle="What kind of event it was and how much harm it caused."
            done={categoryDone}
          >
            <div className="grid sm:grid-cols-2 gap-5">
              <Field
                label="Incident category"
                required
                hint={
                  selectedCategory?.domain ? (
                    <>
                      Domain: <span className="font-semibold text-slate-700">{selectedCategory.domain}</span>
                    </>
                  ) : undefined
                }
              >
                <SearchableSelect
                  value={categoryId}
                  onChange={(v) => {
                    setCategoryId(v);
                    setSubcategoryCode('');
                  }}
                  containerClassName="block w-full"
                  options={[{ value: '', label: 'Select category' }, ...categoryOptions]}
                  searchPlaceholder="Search categories..."
                  className={inputClass}
                />
              </Field>

              <Field label="Subcategory">
                <SearchableSelect
                  value={subcategoryCode}
                  onChange={setSubcategoryCode}
                  disabled={!categoryId}
                  containerClassName="block w-full"
                  options={[
                    { value: '', label: categoryId ? 'Select subcategory' : 'Select a category first' },
                    ...subcategories.map((sc: any) => ({ value: sc.code, label: sc.name })),
                  ]}
                  searchPlaceholder="Search subcategories..."
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold text-slate-700 mb-2">
                Harm / severity level <span className="text-[#C62828]">*</span>
              </p>
              <div role="radiogroup" aria-label="Harm severity level" className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {SEVERITY_LEVELS.map((s) => {
                  const active = severity === s.lvl;
                  return (
                    <button
                      key={s.lvl}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSeverity(s.lvl)}
                      style={
                        active
                          ? { borderColor: s.color, background: s.tint, boxShadow: `0 0 0 4px ${s.color}22` }
                          : undefined
                      }
                      className={`relative text-left p-3.5 rounded-xl border-2 transition cursor-pointer ${
                        active ? '' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        <span
                          className="w-8 h-8 rounded-lg text-white font-black text-sm flex items-center justify-center"
                          style={{ background: s.color }}
                        >
                          {s.lvl}
                        </span>
                        {active && <CheckCircle2 className="w-5 h-5" style={{ color: s.color }} />}
                      </span>
                      <span className="mt-2.5 block text-sm font-bold text-slate-900">{s.name}</span>
                      <span className="block text-xs text-slate-500 mt-0.5">{s.desc}</span>
                    </button>
                  );
                })}
              </div>

              <div
                className="mt-3 px-4 py-3 rounded-xl border-l-4 text-sm animate-tab-panel-in"
                key={severity}
                style={{ borderColor: currentSeverity.color, background: currentSeverity.tint }}
              >
                <p className="font-bold" style={{ color: currentSeverity.color }}>
                  {currentSeverity.label}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">{currentSeverity.sublabel}</p>
              </div>
            </div>
          </Section>

          {/* 3. Patient */}
          <Section
            id="sec-patient"
            step={3}
            icon={User}
            title="Patient details"
            subtitle="Only if a patient was involved or affected."
            optional
            done={patientDone}
            action={
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none shrink-0">
                <span className="hidden sm:inline text-xs font-semibold text-slate-600">Patient involved</span>
                <input
                  type="checkbox"
                  checked={patientInvolved}
                  onChange={(e) => setPatientInvolved(e.target.checked)}
                  className="sr-only peer"
                  aria-label="Patient involved"
                />
                <span className="relative w-11 h-6 rounded-full bg-slate-300 peer-checked:bg-[#8B1E23] peer-focus-visible:ring-4 peer-focus-visible:ring-[#8B1E23]/20 transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-[18px] after:h-[18px] after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"></span>
              </label>
            }
          >
            {patientInvolved ? (
              <div className="grid sm:grid-cols-3 gap-4 animate-tab-panel-in">
                <Field label="UHID (Unique Health ID)" htmlFor="pt-uhid">
                  <input
                    id="pt-uhid"
                    type="text"
                    placeholder="e.g. UHID-61501"
                    value={patient.uhid}
                    onChange={(e) => setPatient({ ...patient, uhid: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="IP number" htmlFor="pt-ip">
                  <input
                    id="pt-ip"
                    type="text"
                    placeholder="e.g. IP07024"
                    value={patient.ipNumber}
                    onChange={(e) => setPatient({ ...patient, ipNumber: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Patient name" htmlFor="pt-name">
                  <input
                    id="pt-name"
                    type="text"
                    placeholder="Full name"
                    value={patient.name}
                    onChange={(e) => setPatient({ ...patient, name: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Age" htmlFor="pt-age">
                  <input
                    id="pt-age"
                    type="number"
                    min={0}
                    placeholder="Years"
                    value={patient.age}
                    onChange={(e) => setPatient({ ...patient, age: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Gender">
                  <SearchableSelect
                    value={patient.gender}
                    onChange={(v) => setPatient({ ...patient, gender: v })}
                    containerClassName="block w-full"
                    options={[
                      { value: 'Male', label: 'Male' },
                      { value: 'Female', label: 'Female' },
                      { value: 'Other', label: 'Other' },
                    ]}
                    searchPlaceholder="Search..."
                    className={inputClass}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ward" htmlFor="pt-ward">
                    <input
                      id="pt-ward"
                      type="text"
                      placeholder="e.g. Ward 3"
                      value={patient.ward}
                      onChange={(e) => setPatient({ ...patient, ward: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Bed" htmlFor="pt-bed">
                    <input
                      id="pt-bed"
                      type="text"
                      placeholder="e.g. 12"
                      value={patient.bed}
                      onChange={(e) => setPatient({ ...patient, bed: e.target.value })}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No patient involved — nothing to fill in here. Switch on <strong>Patient involved</strong> to add details.
              </p>
            )}
          </Section>

          {/* 4. What happened */}
          <Section
            id="sec-details"
            step={4}
            icon={FileText}
            title="What happened"
            subtitle="A short title, the facts, and what was done straight away."
            done={detailsDone}
          >
            <div className="space-y-5">
              <Field label="Brief title" required htmlFor="inc-title">
                <input
                  id="inc-title"
                  type="text"
                  required
                  placeholder="e.g. Patient fall near bedside in Ward 3"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Detailed description" required htmlFor="inc-desc" hint="Stick to facts: what, who, when, and what you saw.">
                <textarea
                  id="inc-desc"
                  required
                  rows={5}
                  placeholder="Provide an exact, factual description of what happened..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={textareaClass}
                ></textarea>
              </Field>

              <Field label="Immediate action taken" htmlFor="inc-action">
                <textarea
                  id="inc-action"
                  rows={3}
                  placeholder="Immediate medical intervention, equipment isolation, or corrective step taken..."
                  value={immediateAction}
                  onChange={(e) => setImmediateAction(e.target.value)}
                  className={textareaClass}
                ></textarea>
              </Field>
            </div>
          </Section>

          {/* 5. Evidence */}
          <Section
            id="sec-evidence"
            step={5}
            icon={Paperclip}
            title="Evidence & attachments"
            subtitle="Photos, reports, logs or witness statements — PDF, PNG, JPG, DOCX up to 10MB each."
            optional
            done={evidenceDone}
          >
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`group relative border-2 border-dashed rounded-2xl px-6 py-8 text-center transition-all duration-200 cursor-pointer ${
                isDragging
                  ? 'border-[#8B1E23] bg-[#FFF5F5] ring-4 ring-[#8B1E23]/10'
                  : 'border-slate-300 bg-slate-50/60 hover:bg-[#FFF5F5]/50 hover:border-[#8B1E23]/60'
              }`}
            >
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                title="Click or drag files to upload"
              />

              <div className="flex flex-col items-center justify-center pointer-events-none">
                <div
                  className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-3 transition-transform duration-200 ${
                    isDragging
                      ? 'bg-[#8B1E23] text-white border-[#8B1E23] scale-110'
                      : 'bg-white text-[#8B1E23] border-slate-200 shadow-sm group-hover:scale-105'
                  }`}
                >
                  {uploading ? (
                    <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>

                <p className="text-sm font-semibold text-slate-800">
                  {uploading ? (
                    <span className="text-[#8B1E23]">Uploading file(s)... please wait</span>
                  ) : (
                    <>
                      <span className="text-[#8B1E23] font-bold">Click to upload</span> or drag and drop files here
                    </>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-1">Incident photos, diagnostic reports, equipment logs, witness statements</p>
              </div>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-600">Attached files ({uploadedFiles.length})</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file._id}
                      className="px-3.5 py-3 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-[#8B1E23]/40 flex items-center justify-between transition"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className="w-9 h-9 rounded-lg bg-[#FFF5F5] border border-red-100 flex items-center justify-center shrink-0 text-[#8B1E23]">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate" title={file.originalName}>
                            {file.originalName}
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>{file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Uploaded'}</span>
                            <span>•</span>
                            <span className="text-clinicalSuccess font-medium inline-flex items-center">
                              <CheckCircle2 className="w-3 h-3 mr-0.5" /> Uploaded
                            </span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file._id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0 cursor-pointer"
                        title="Remove file"
                        aria-label={`Remove ${file.originalName}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Floating action bar */}
          <div className="sticky bottom-4 z-30">
            <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)] px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="min-w-0 text-sm">
                {success ? (
                  <p className="flex items-center gap-2 font-semibold text-emerald-700">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>{success}</span>
                  </p>
                ) : error ? (
                  <p className="flex items-center gap-2 font-medium text-red-700">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                  </p>
                ) : (
                  <p className="text-slate-600 flex items-center gap-2.5">
                    <span className="hidden sm:block w-28 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-[#E53935] to-[#8B1E23] transition-[width] duration-500"
                        style={{ width: `${progress}%` }}
                      ></span>
                    </span>
                    <span>
                      {progress === 100 ? 'All required fields done — ready to submit.' : `${requiredChecks.length - requiredDone} required field(s) left`}
                    </span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate('/my-reports')}
                  className="h-11 px-5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 font-semibold text-sm rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || Boolean(success)}
                  className="group relative overflow-hidden h-11 px-7 bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] hover:brightness-110 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-button-red transition-all duration-200 flex items-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
                  <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                  <span className="relative z-10 flex items-center gap-2">
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-4 h-4" />
                        <span>Submit Report</span>
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
