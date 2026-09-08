import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Upload, CheckCircle2, User, Building, MapPin, Tag, FileText, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

export default function ReportIncidentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [incidentDateTime, setIncidentDateTime] = useState(new Date().toISOString().slice(0, 16));
  const [departmentId, setDepartmentId] = useState('');
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
    queryKey: ['locations', departmentId],
    queryFn: () => api.get(departmentId ? `/locations?departmentId=${departmentId}` : '/locations'),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories'),
  });

  const departments = (departmentsData as any)?.data || [];
  const locations = (locationsData as any)?.data || [];
  const categories = (categoriesData as any)?.data || [];

  const selectedCategory = categories.find((c: any) => c._id === categoryId);
  const subcategories = selectedCategory?.subcategories || [];

  const severityLabels: Record<number, { label: string; bg: string; text: string }> = {
    1: { label: 'Level 1 – Near Miss (No Harm)', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
    2: { label: 'Level 2 – Minor Harm', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
    3: { label: 'Level 3 – Moderate Harm', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
    4: { label: 'Level 4 – Major Harm', bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
    5: { label: 'Level 5 – Critical / Sentinel Event', bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

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
      alert(err?.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload: any = {
        incidentDateTime,
        departmentId,
        locationId,
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Title Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center space-x-2">
            <ShieldAlert className="w-6 h-6 text-hospital-600" />
            <span>Report Hospital Safety Incident / Near Miss</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Complete the form below to initiate triage, investigation, and safety management.
          </p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 bg-hospital-50 text-hospital-700 rounded-full border border-hospital-200">
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

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
        {/* Section 1: Event Context */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center space-x-2">
            <Building className="w-4 h-4 text-hospital-600" />
            <span>1. Location & Event Date</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                Date & Time of Incident *
              </label>
              <input
                type="datetime-local"
                required
                value={incidentDateTime}
                onChange={(e) => setIncidentDateTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-hospital-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Department *</label>
              <select
                required
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-hospital-500 focus:bg-white"
              >
                <option value="">-- Select Department --</option>
                {departments.map((d: any) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Location / Ward *</label>
              <select
                required
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-hospital-500 focus:bg-white"
              >
                <option value="">-- Select Location --</option>
                {locations.map((l: any) => (
                  <option key={l._id} value={l._id}>
                    {l.name} [{l.type}]
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Category & Classification */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center space-x-2">
            <Tag className="w-4 h-4 text-hospital-600" />
            <span>2. Category & Initial Severity</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Incident Category *</label>
              <select
                required
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSubcategoryCode('');
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-hospital-500 focus:bg-white"
              >
                <option value="">-- Select Category --</option>
                {categories.map((c: any) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Subcategory</label>
              <select
                value={subcategoryCode}
                onChange={(e) => setSubcategoryCode(e.target.value)}
                disabled={!categoryId}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-hospital-500 focus:bg-white disabled:opacity-50"
              >
                <option value="">-- Select Subcategory --</option>
                {subcategories.map((sc: any) => (
                  <option key={sc.code} value={sc.code}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Initial Harm / Severity Level *
            </label>
            <div className="space-y-2">
              <input
                type="range"
                min="1"
                max="5"
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                className="w-full accent-hospital-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
              />
              <div
                className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between ${severityLabels[severity]?.bg} ${severityLabels[severity]?.text}`}
              >
                <span>{severityLabels[severity]?.label}</span>
                <span className="text-[10px] uppercase tracking-wider font-bold">Severity {severity} / 5</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Patient Information Toggle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <User className="w-4 h-4 text-hospital-600" />
              <span>3. Patient Details (Optional / If Involved)</span>
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={patientInvolved}
                onChange={(e) => setPatientInvolved(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-hospital-600"></div>
              <span className="ml-2 text-xs font-semibold text-slate-600">Patient Involved?</span>
            </label>
          </div>

          {patientInvolved && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                  UHID (Unique Health ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UHID-61501"
                  value={patient.uhid}
                  onChange={(e) => setPatient({ ...patient, uhid: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">IP Number</label>
                <input
                  type="text"
                  placeholder="e.g. IP07024"
                  value={patient.ipNumber}
                  onChange={(e) => setPatient({ ...patient, ipNumber: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Patient Name</label>
                <input
                  type="text"
                  placeholder="Patient Full Name"
                  value={patient.name}
                  onChange={(e) => setPatient({ ...patient, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Age</label>
                <input
                  type="number"
                  placeholder="Age in Years"
                  value={patient.age}
                  onChange={(e) => setPatient({ ...patient, age: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Gender</label>
                <select
                  value={patient.gender}
                  onChange={(e) => setPatient({ ...patient, gender: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Ward / Bed</label>
                <input
                  type="text"
                  placeholder="e.g. Ward 3, Bed 12"
                  value={patient.ward}
                  onChange={(e) => setPatient({ ...patient, ward: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Incident Description & Immediate Action */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center space-x-2">
            <FileText className="w-4 h-4 text-hospital-600" />
            <span>4. Incident Description & Immediate Action</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Incident Brief Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Patient fall near bedside in Ward 3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-hospital-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Detailed Description *</label>
            <textarea
              required
              rows={4}
              placeholder="Provide exact factual description of what happened..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-hospital-500 focus:bg-white"
            ></textarea>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              Immediate Action Taken
            </label>
            <textarea
              rows={2}
              placeholder="Immediate medical intervention, equipment isolation, or corrective step taken..."
              value={immediateAction}
              onChange={(e) => setImmediateAction(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-hospital-500 focus:bg-white"
            ></textarea>
          </div>
        </div>

        {/* Section 5: Attachments Upload */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center space-x-2">
            <Upload className="w-4 h-4 text-hospital-600" />
            <span>5. Evidence Upload (Optional)</span>
          </h3>

          <div className="flex items-center space-x-4">
            <label className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg cursor-pointer transition flex items-center space-x-2">
              <Upload className="w-4 h-4" />
              <span>{uploading ? 'Uploading...' : 'Choose Photo / Document'}</span>
              <input type="file" onChange={handleFileUpload} disabled={uploading} className="hidden" />
            </label>
            <span className="text-[11px] text-slate-400">PDF, PNG, JPG, DOCX up to 10MB</span>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {uploadedFiles.map((file) => (
                <div key={file._id} className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-xs font-medium flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>{file.originalName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Action Bar */}
        <div className="pt-6 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/incidents')}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-hospital-600 hover:bg-hospital-700 active:bg-hospital-800 text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-lg transition flex items-center space-x-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <span>Submit Incident Report</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
