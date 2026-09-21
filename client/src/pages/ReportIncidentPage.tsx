import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Upload, CheckCircle2, User, Building, MapPin, Tag, FileText, AlertTriangle, X } from 'lucide-react';
import { api } from '../lib/api';
import dayjs from 'dayjs';
import { departmentOptions } from '../components/ui/DepartmentOptions';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { toast } from '../store/useToastStore';
import { errorMessage } from '../lib/useAction';

const FLOORS = ['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4', 'Floor 5'] as const;
const ZONES = ['Zone-1', 'Zone-B', 'Zone-C'] as const;

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

  const severityLabels: Record<
    number,
    {
      label: string;
      sublabel: string;
      bg: string;
      text: string;
      border: string;
      color: string;
      accentClass: string;
      pillActive: string;
    }
  > = {
    1: {
      label: 'Level 1 – Near Miss (No Harm)',
      sublabel: 'Incident caught or occurred with zero harm',
      bg: 'bg-[#ECFDF5]',
      border: 'border-[#A7F3D0]',
      text: 'text-[#065F46]',
      color: '#10B981',
      accentClass: 'accent-emerald-600',
      pillActive: 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-200',
    },
    2: {
      label: 'Level 2 – Minor Harm',
      sublabel: 'Minimal intervention or basic observation required',
      bg: 'bg-[#F0F9FF]',
      border: 'border-[#BAE6FD]',
      text: 'text-[#0369A1]',
      color: '#0284C7',
      accentClass: 'accent-sky-600',
      pillActive: 'bg-sky-600 text-white border-sky-700 shadow-sm ring-2 ring-sky-200',
    },
    3: {
      label: 'Level 3 – Moderate Harm',
      sublabel: 'Reversible harm requiring medical or surgical intervention',
      bg: 'bg-[#FFF7ED]',
      border: 'border-[#FED7AA]',
      text: 'text-[#C2410C]',
      color: '#EA580C',
      accentClass: 'accent-orange-500',
      pillActive: 'bg-[#EA580C] text-white border-[#C2410C] shadow-sm ring-2 ring-orange-200',
    },
    4: {
      label: 'Level 4 – Major Harm',
      sublabel: 'Permanent impairment or prolonged hospital stay',
      bg: 'bg-[#FEF2F2]',
      border: 'border-[#FECACA]',
      text: 'text-[#B91C1C]',
      color: '#DC2626',
      accentClass: 'accent-red-600',
      pillActive: 'bg-red-600 text-white border-red-700 shadow-sm ring-2 ring-red-200 font-bold',
    },
    5: {
      label: 'Level 5 – Critical / Sentinel Event',
      sublabel: 'Catastrophic event, patient death or permanent severe loss of function',
      bg: 'bg-[#6B1418]',
      border: 'border-[#4A0D10]',
      text: 'text-white font-black',
      color: '#6B1418',
      accentClass: 'accent-[#6B1418]',
      pillActive: 'bg-[#6B1418] text-white border-[#4A0D10] shadow-md ring-2 ring-red-900/30 font-black',
    },
  };


  const [isDragging, setIsDragging] = useState(false);

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
      {/* Page Title Header - dark theme */}
      <div className="bg-gradient-to-r from-[#241014] via-[#1B0E11] to-[#150A0C] p-6 sm:p-7 rounded-2xl border border-[#3D1B1F] shadow-[0_4px_20px_rgba(0,0,0,0.25)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-start space-x-2">
            <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5 text-[#F06B70]" />
            <span>Report Hospital Safety Incident / Near Miss</span>
          </h2>
          <p className="text-xs text-slate-300/80 mt-1">
            Complete the form below to initiate triage, investigation, and safety management.
          </p>
        </div>
        <span className="self-start sm:self-auto shrink-0 text-xs font-bold px-3.5 py-1 bg-white/10 text-[#F5A5A8] rounded-full border border-white/15">
          Target: &lt; 3 Mins Submission
        </span>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-clinicalBorder shadow-card space-y-8">
        {/* Section 1: Event Context */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-clinicalText-primary uppercase tracking-wider border-b border-clinicalBorder pb-2 flex items-center space-x-2">
            <Building className="w-4 h-4 text-maroon-700" />
            <span>1. Location & Event Date</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary uppercase mb-1">
                Date & Time of Incident *
              </label>
              <input
                type="datetime-local"
                required
                value={incidentDateTime}
                onChange={(e) => setIncidentDateTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary uppercase mb-1">Department Where It Occurred *</label>
              <SearchableSelect
                value={departmentId}
                onChange={setDepartmentId}
                options={[
                  { value: '', label: '-- Select Department --' },
                  ...departmentOptions(departments, (d) => `${d.name} (${d.code})`),
                ]}
                searchPlaceholder="Search departments..."
                className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
              <p className="mt-1 text-[11px] text-clinicalText-muted">
                Quality reviews every report and assigns it to the responsible department's HOD.
              </p>
            </div>

            {/* Two-step Floor and Zone Selection */}
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary uppercase mb-1">
                Hospital Floor (Step 1) *
              </label>
              <SearchableSelect
                value={selectedFloor}
                onChange={(f) => {
                  setSelectedFloor(f);
                  setSelectedZone('');
                  setLocationId('');
                }}
                options={[{ value: '', label: '-- Select Floor (1 of 5) --' }, ...FLOORS.map((f) => ({ value: f, label: f }))]}
                searchPlaceholder="Search floors..."
                className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary uppercase mb-1">
                Zone (Step 2) *
              </label>
              <SearchableSelect
                disabled={!selectedFloor}
                value={selectedZone}
                onChange={(z) => {
                  setSelectedZone(z);
                  const matches = locations.filter((l: any) => l.floor === selectedFloor && l.zone === z);
                  if (matches.length > 0) {
                    const exact = matches.find((m: any) => m.code.startsWith('FL')) || matches[0];
                    setLocationId(exact._id);
                  } else {
                    setLocationId('');
                  }
                }}
                options={[
                  { value: '', label: selectedFloor ? '-- Select Zone (Zone-1, Zone-B, Zone-C) --' : '-- Select Floor First --' },
                  ...ZONES.map((z) => ({ value: z, label: z })),
                ]}
                searchPlaceholder="Search zones..."
                className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition disabled:opacity-50 disabled:bg-slate-100"
              />
            </div>

            {/* Optional Specific Room/Ward Sub-selector if multiple locations match */}
            {selectedFloor && selectedZone && matchingLocations.length > 1 && (
              <div className="sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-clinicalBorder">
                <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">
                  Specific Room / Ward / Bay in {selectedFloor} • {selectedZone} (Optional)
                </label>
                <SearchableSelect
                  value={locationId}
                  onChange={setLocationId}
                  options={matchingLocations.map((l: any) => ({ value: l._id, label: `${l.name} ${l.type ? `[${l.type}]` : ''}`.trim() }))}
                  searchPlaceholder="Search rooms..."
                  className="w-full px-3 py-2 bg-white border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 transition"
                />
              </div>
            )}

            {/* Visual Location Confirmation Badge */}
            {selectedFloor && selectedZone && (
              <div className="sm:col-span-2 flex items-center space-x-2 text-xs text-maroon-700 bg-red-50/80 px-3.5 py-2.5 rounded-xl border border-red-100">
                <MapPin className="w-4 h-4 shrink-0 text-maroon-700" />
                <span>
                  Designated Incident Location: <strong>{selectedFloor}</strong> &bull; <strong>{selectedZone}</strong>
                  {selectedLocation && !selectedLocation.code.startsWith('FL') ? ` (${selectedLocation.name})` : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Category & Classification */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-clinicalText-primary uppercase tracking-wider border-b border-clinicalBorder pb-2 flex items-center space-x-2">
            <Tag className="w-4 h-4 text-maroon-700" />
            <span>2. Category & Initial Severity</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary uppercase mb-1">Incident Category *</label>
              <SearchableSelect
                value={categoryId}
                onChange={(v) => {
                  setCategoryId(v);
                  setSubcategoryCode('');
                }}
                options={[{ value: '', label: '-- Select Category --' }, ...categoryOptions]}
                searchPlaceholder="Search categories..."
                className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
              {selectedCategory?.domain && (
                <p className="text-[11px] text-clinicalText-muted mt-1">
                  Domain: <span className="font-semibold text-slate-700">{selectedCategory.domain}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary uppercase mb-1">Subcategory</label>
              <SearchableSelect
                value={subcategoryCode}
                onChange={setSubcategoryCode}
                disabled={!categoryId}
                options={[
                  { value: '', label: '-- Select Subcategory --' },
                  ...subcategories.map((sc: any) => ({ value: sc.code, label: sc.name })),
                ]}
                searchPlaceholder="Search subcategories..."
                className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white disabled:opacity-50 transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-clinicalText-secondary uppercase">
                Harm / Severity Level *
              </label>
              <span className="text-[11px] text-clinicalText-muted font-medium">
                Level 1 (Near Miss) → Level 5 (Sentinel Event)
              </span>
            </div>

            {/* Clickable 5-level clinical selector pills */}
            <div className="grid grid-cols-5 gap-1.5 mb-2.5">
              {[
                { lvl: 1, name: 'L1 Near Miss', desc: 'No Harm' },
                { lvl: 2, name: 'L2 Minor', desc: 'Minimal' },
                { lvl: 3, name: 'L3 Moderate', desc: 'Moderate' },
                { lvl: 4, name: 'L4 Major', desc: 'Severe' },
                { lvl: 5, name: 'L5 Sentinel', desc: 'Catastrophic' },
              ].map(({ lvl, name, desc }) => {
                const isActive = severity === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSeverity(lvl)}
                    className={`py-2 px-1 text-center rounded-xl border transition-all duration-150 cursor-pointer ${
                      isActive
                        ? severityLabels[lvl]?.pillActive
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="text-[11px] font-bold leading-tight">{name}</div>
                    <div className={`text-[9px] mt-0.5 ${isActive ? 'text-white/85' : 'text-slate-400'}`}>
                      {desc}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min="1"
                max="5"
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                className={`w-full ${severityLabels[severity]?.accentClass} h-2 bg-slate-200 rounded-lg cursor-pointer transition`}
              />
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-colors duration-150 shadow-xs ${severityLabels[severity]?.bg} ${severityLabels[severity]?.border} ${severityLabels[severity]?.text}`}
              >
                <div>
                  <span className="font-bold block text-xs">{severityLabels[severity]?.label}</span>
                  <span className="text-[11px] opacity-80 mt-0.5 block">{severityLabels[severity]?.sublabel}</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-lg border border-current/20 bg-white/20 whitespace-nowrap">
                  Severity {severity} of 5
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Patient Information Toggle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-clinicalBorder pb-2">
            <h3 className="text-sm font-bold text-clinicalText-primary uppercase tracking-wider flex items-center space-x-2">
              <User className="w-4 h-4 text-maroon-700" />
              <span>3. Patient Details (Optional / If Involved)</span>
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={patientInvolved}
                onChange={(e) => setPatientInvolved(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-maroon-700"></div>
              <span className="ml-2 text-xs font-semibold text-clinicalText-secondary">Patient Involved?</span>
            </label>
          </div>

          {patientInvolved && (
            <div className="p-4 bg-slate-50 rounded-xl border border-clinicalBorder grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-clinicalText-secondary uppercase mb-1">
                  UHID (Unique Health ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UHID-61501"
                  value={patient.uhid}
                  onChange={(e) => setPatient({ ...patient, uhid: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-clinicalBorder rounded text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-clinicalText-secondary uppercase mb-1">IP Number</label>
                <input
                  type="text"
                  placeholder="e.g. IP07024"
                  value={patient.ipNumber}
                  onChange={(e) => setPatient({ ...patient, ipNumber: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-clinicalBorder rounded text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-clinicalText-secondary uppercase mb-1">Patient Name</label>
                <input
                  type="text"
                  placeholder="Patient Full Name"
                  value={patient.name}
                  onChange={(e) => setPatient({ ...patient, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-clinicalBorder rounded text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-clinicalText-secondary uppercase mb-1">Age</label>
                <input
                  type="number"
                  placeholder="Age in Years"
                  value={patient.age}
                  onChange={(e) => setPatient({ ...patient, age: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-clinicalBorder rounded text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-clinicalText-secondary uppercase mb-1">Gender</label>
                <SearchableSelect
                  value={patient.gender}
                  onChange={(v) => setPatient({ ...patient, gender: v })}
                  options={[
                    { value: 'Male', label: 'Male' },
                    { value: 'Female', label: 'Female' },
                    { value: 'Other', label: 'Other' },
                  ]}
                  searchPlaceholder="Search..."
                  className="w-full px-3 py-1.5 bg-white border border-clinicalBorder rounded text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-clinicalText-secondary uppercase mb-1">Ward / Bed</label>
                <input
                  type="text"
                  placeholder="e.g. Ward 3, Bed 12"
                  value={patient.ward}
                  onChange={(e) => setPatient({ ...patient, ward: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-clinicalBorder rounded text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 transition"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Incident Description & Immediate Action */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-clinicalText-primary uppercase tracking-wider border-b border-clinicalBorder pb-2 flex items-center space-x-2">
            <FileText className="w-4 h-4 text-maroon-700" />
            <span>4. Incident Description & Immediate Action</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-clinicalText-secondary uppercase mb-1">Incident Brief Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Patient fall near bedside in Ward 3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-clinicalText-secondary uppercase mb-1">Detailed Description *</label>
            <textarea
              required
              rows={4}
              placeholder="Provide exact factual description of what happened..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
            ></textarea>
          </div>

          <div>
            <label className="block text-xs font-semibold text-clinicalText-secondary uppercase mb-1">
              Immediate Action Taken
            </label>
            <textarea
              rows={2}
              placeholder="Immediate medical intervention, equipment isolation, or corrective step taken..."
              value={immediateAction}
              onChange={(e) => setImmediateAction(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
            ></textarea>
          </div>
        </div>

        {/* Section 5: Attachments Upload */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-clinicalBorder pb-2">
            <h3 className="text-sm font-bold text-clinicalText-primary uppercase tracking-wider flex items-center space-x-2">
              <Upload className="w-4 h-4 text-[#8B1E23]" />
              <span>5. Evidence & Attachments (Optional)</span>
            </h3>
            <span className="text-[11px] text-clinicalText-muted font-medium">
              PDF, PNG, JPG, DOCX (Max 10MB each)
            </span>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`group relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer ${
              isDragging
                ? 'border-[#8B1E23] bg-[#FFF5F5] ring-4 ring-[#8B1E23]/10 scale-[1.005]'
                : 'border-slate-300 bg-slate-50/60 hover:bg-[#FFF5F5]/40 hover:border-[#8B1E23]/60'
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
                className={`w-12 h-12 rounded-full border flex items-center justify-center mb-2.5 transition-transform duration-200 ${
                  isDragging
                    ? 'bg-[#8B1E23] text-white border-[#8B1E23] scale-110'
                    : 'bg-white text-[#8B1E23] border-slate-200 shadow-xs group-hover:scale-105'
                }`}
              >
                {uploading ? (
                  <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
              </div>

              <p className="text-xs font-semibold text-clinicalText-primary">
                {uploading ? (
                  <span className="text-[#8B1E23]">Uploading file(s)... please wait</span>
                ) : (
                  <>
                    <span className="text-[#8B1E23] font-bold hover:underline">Click to upload</span> or drag and drop files here
                  </>
                )}
              </p>
              <p className="text-[11px] text-clinicalText-muted mt-1">
                Upload incident photos, diagnostic reports, equipment logs, or witness statements
              </p>
            </div>
          </div>

          {/* Uploaded Files Cards */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-semibold text-clinicalText-secondary">
                <span>Attached Files ({uploadedFiles.length})</span>
                <span className="text-[11px] text-clinicalText-muted">Ready to submit with report</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {uploadedFiles.map((file) => (
                  <div
                    key={file._id}
                    className="group relative px-3.5 py-2.5 bg-white border border-clinicalBorder rounded-xl shadow-xs hover:border-[#8B1E23]/40 flex items-center justify-between transition"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                      <div className="w-8 h-8 rounded-lg bg-[#FFF5F5] border border-red-100 flex items-center justify-center shrink-0 text-[#8B1E23]">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-clinicalText-primary truncate" title={file.originalName}>
                          {file.originalName}
                        </p>
                        <p className="text-[10px] text-clinicalText-muted flex items-center space-x-1.5 mt-0.5">
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(file._id);
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0 cursor-pointer"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit Action Bar */}
        <div className="pt-6 border-t border-clinicalBorder flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/my-reports')}
            className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-clinicalBorder text-clinicalText-secondary hover:text-clinicalText-primary font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="group relative overflow-hidden px-8 py-3 bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] hover:from-[#7A1A1E] hover:via-[#8B1E23] hover:to-[#B71C1C] active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-button-red hover:shadow-lg transition-all duration-200 flex items-center space-x-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {/* Gloss shine overlay across top half */}
            <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-xl" />

            {/* Diagonal sheen sweep on hover */}
            <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />

            <span className="relative z-10 flex items-center space-x-2">
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Incident...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-white/90" />
                  <span>Submit Incident Report</span>
                </>
              )}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
