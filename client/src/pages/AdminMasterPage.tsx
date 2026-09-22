import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Users, Building, MapPin, Tag, PlusCircle, Plus, Upload, Download, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { api } from '../lib/api';
import { departmentOptions, DEPARTMENT_CATEGORIES } from '../components/ui/DepartmentOptions';
import { toast } from '../store/useToastStore';
import { errorMessage } from '../lib/useAction';
import { useSlidingIndicator } from '../lib/useSlidingIndicator';
import { SearchableSelect } from '../components/ui/SearchableSelect';

const LOCATION_TYPES = ['WARD', 'ROOM', 'OT', 'ICU', 'LAB', 'OPD', 'OTHER'];
const FLOORS = ['Ground Floor', 'Floor 1', 'Floor 2', 'Floor 3', 'Floor 4', 'Floor 5'] as const;
const ZONES = ['Zone-1', 'Zone-B', 'Zone-C'] as const;

export default function AdminMasterPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'locations' | 'categories'>('users');
  const { indicatorStyle, registerTab } = useSlidingIndicator(activeTab);

  // User form state (shared by create and edit; editingUser is null when creating)
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [empId, setEmpId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [designation, setDesignation] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [deptId, setDeptId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [userStatus, setUserStatus] = useState('ACTIVE');
  const [replaceHod, setReplaceHod] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Password reset state
  const [resetUser, setResetUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');

  // Bulk import state
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [csvRawText, setCsvRawText] = useState('');
  const [bulkUpdateExisting, setBulkUpdateExisting] = useState(false);
  const [bulkParsedRows, setBulkParsedRows] = useState<any[]>([]);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState<any>(null);

  const parseCsvText = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      headers.forEach((h, idx) => {
        const val = values[idx] || '';
        if (h.includes('empid') || h === 'employeeid') obj.employeeId = val;
        else if (h === 'name' || h === 'fullname') obj.name = val;
        else if (h === 'email') obj.email = val;
        else if (h === 'username') obj.username = val;
        else if (h.includes('dept') || h === 'departmentcode') obj.departmentCode = val;
        else if (h.includes('role') || h === 'rolecode') obj.roleCode = val || 'STAFF';
        else if (h.includes('designation') || h === 'title') obj.designation = val;
        else if (h.includes('phone') || h === 'mobile') obj.phone = val;
        else if (h.includes('password') || h === 'pwd') obj.password = val;
      });
      if (obj.employeeId && obj.name && obj.email && obj.username) {
        rows.push(obj);
      }
    }
    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setCsvRawText(text);
      setBulkParsedRows(parseCsvText(text));
      setBulkImportResult(null);
    };
    reader.readAsText(file);
  };

  const handleCsvTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCsvRawText(text);
    setBulkParsedRows(parseCsvText(text));
    setBulkImportResult(null);
  };

  const downloadSampleCsv = () => {
    const csvContent = `# Adhiparasakthi Hospitals - HR Staff Bulk Onboarding Template
# departmentCode: EMERGENCY, ICU, OT, WARD, PHARMACY, RADIOLOGY, LAB, QUALITY
# roleCode: STAFF, HOD, QUALITY, ADMIN (defaults to STAFF)
employeeId,name,email,username,departmentCode,roleCode,designation,phone,password
EMP-EMG-101,Dr. Ananya Nair,ananya.nair@adhiparasakthi.org,dr.ananya,EMERGENCY,STAFF,Emergency Medical Officer,9840112345,Staff@123
EMP-EMG-102,Staff Nurse Rajesh,rajesh.k@adhiparasakthi.org,nurse.rajesh,EMERGENCY,STAFF,Senior Staff Nurse,9840112346,Staff@123
EMP-ICU-201,Dr. Karthik Sundar,karthik.sundar@adhiparasakthi.org,dr.karthik,ICU,STAFF,Intensivist / Registrar,9840112347,Staff@123
EMP-WRD-401,Staff Nurse Kavitha,kavitha.m@adhiparasakthi.org,nurse.kavitha,WARD,STAFF,Ward Staff Nurse,9840112351,Staff@123
`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_staff_import.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteBulkImport = async () => {
    if (bulkParsedRows.length === 0) {
      toast.error('Please upload a CSV or paste valid CSV data with header and rows.');
      return;
    }
    setBulkImportLoading(true);
    try {
      const res = await api.post('/users/bulk-import', {
        users: bulkParsedRows,
        updateExisting: bulkUpdateExisting,
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setBulkImportResult((res as any)?.data || res);
    } catch (err: any) {
      toast.error(errorMessage(err, 'Bulk import failed'));
    } finally {
      setBulkImportLoading(false);
    }
  };

  // Location form state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locCode, setLocCode] = useState('');
  const [locName, setLocName] = useState('');
  const [locFloor, setLocFloor] = useState('Floor 1');
  const [locZone, setLocZone] = useState('Zone-1');
  const [locType, setLocType] = useState('ROOM');
  const [locDeptId, setLocDeptId] = useState('');
  const [locFloorFilter, setLocFloorFilter] = useState('');
  const [locZoneFilter, setLocZoneFilter] = useState('');
  const [locSearch, setLocSearch] = useState('');

  // Department form state
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptCategory, setDeptCategory] = useState('');
  const [deptSearch, setDeptSearch] = useState('');
  const [deptCategoryFilter, setDeptCategoryFilter] = useState('');

  // Category form state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryCode, setCategoryCode] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryDomain, setCategoryDomain] = useState('');
  const [categorySubcategories, setCategorySubcategories] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryDomainFilter, setCategoryDomainFilter] = useState('');

  // Subcategory form state
  const [showSubModal, setShowSubModal] = useState(false);
  const [targetCategory, setTargetCategory] = useState<any>(null);
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');

  // Queries
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users?limit=200'),
  });

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles'),
  });

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
  const departmentCategories: string[] = Array.from(new Set(departments.map((d: any) => d.category).filter(Boolean)));
  const filteredDepartments = departments.filter((d: any) => {
    if (deptCategoryFilter && d.category !== deptCategoryFilter) return false;
    if (!deptSearch) return true;
    const q = deptSearch.toLowerCase();
    return d.name?.toLowerCase().includes(q) || d.code?.toLowerCase().includes(q);
  });
  const locations = (locationsData as any)?.data || [];

  const filteredLocations = locations.filter((l: any) => {
    if (locFloorFilter && l.floor !== locFloorFilter) return false;
    if (locZoneFilter && l.zone !== locZoneFilter) return false;
    if (!locSearch) return true;
    const q = locSearch.toLowerCase();
    return (
      l.name?.toLowerCase().includes(q) ||
      l.code?.toLowerCase().includes(q) ||
      l.floor?.toLowerCase().includes(q) ||
      l.zone?.toLowerCase().includes(q) ||
      l.departmentId?.name?.toLowerCase().includes(q)
    );
  });
  const categories = (categoriesData as any)?.data || [];
  const categoryDomains: string[] = Array.from(
    new Set(categories.map((c: any) => c.domain).filter(Boolean))
  );

  const filteredCategories = categories.filter((c: any) => {
    if (categoryDomainFilter && c.domain !== categoryDomainFilter) return false;
    if (!categorySearch) return true;
    const q = categorySearch.toLowerCase();
    const matchCategory =
      c.name?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q) ||
      c.domain?.toLowerCase().includes(q);
    const matchSub = c.subcategories?.some(
      (sc: any) => sc.name?.toLowerCase().includes(q) || sc.code?.toLowerCase().includes(q)
    );
    return matchCategory || matchSub;
  });
  const users = (usersData as any)?.data || [];
  const roles = (rolesData as any)?.data || [];
  const roleById = (id: string) => roles.find((r: any) => r._id === id);
  const selectedRoleCode = roleById(roleId)?.code;
  const needsDepartment = selectedRoleCode === 'STAFF' || selectedRoleCode === 'HOD';
  const isHodRole = selectedRoleCode === 'HOD';
  const selectedDept = departments.find((d: any) => d._id === deptId);
  const currentDeptHod = selectedDept?.hodUserId;
  const hodConflict =
    selectedRoleCode === 'HOD' &&
    currentDeptHod &&
    currentDeptHod.status === 'ACTIVE' &&
    currentDeptHod._id !== editingUser?._id;

  const filteredUsers = users.filter((u: any) => {
    if (roleFilter && !u.roles?.some((r: any) => r.code === roleFilter)) return false;
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return [u.name, u.username, u.email, u.employeeId].some((v) => v?.toLowerCase().includes(q));
  });

  const hodsFor = (departmentId: string) =>
    users.filter(
      (u: any) =>
        u.status === 'ACTIVE' &&
        u.departmentId?._id === departmentId &&
        u.roles?.some((r: any) => r.code === 'HOD')
    );

  const openCreateUser = () => {
    setEditingUser(null);
    setEmpId('');
    setName('');
    setEmail('');
    setUsername('');
    setPassword('');
    setDesignation('');
    setWhatsappNumber('');
    setDeptId('');
    setRoleId(roles.find((r: any) => r.code === 'STAFF')?._id || '');
    setUserStatus('ACTIVE');
    setReplaceHod(false);
    setShowUserModal(true);
  };

  const openEditUser = (u: any) => {
    setEditingUser(u);
    setEmpId(u.employeeId);
    setName(u.name);
    setEmail(u.email);
    setUsername(u.username);
    setPassword('');
    setDesignation(u.designation || '');
    setWhatsappNumber(u.whatsappNumber || '');
    setDeptId(u.departmentId?._id || '');
    setRoleId(u.roles?.[0]?._id || '');
    setUserStatus(u.status);
    setReplaceHod(false);
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleId) {
      toast.error('Please choose a role');
      return;
    }
    if (needsDepartment && !deptId) {
      toast.error('Please choose a department');
      return;
    }
    try {
      const common = {
        name,
        email,
        designation,
        whatsappNumber: isHodRole ? whatsappNumber : '',
        departmentId: deptId || null,
        roles: [roleId],
        replaceDepartmentHod: replaceHod,
      };
      if (editingUser) {
        await api.patch(`/users/${editingUser._id}`, { ...common, status: userStatus });
      } else {
        await api.post('/users', { ...common, employeeId: empId, username, password });
      }
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setShowUserModal(false);
      toast.success(editingUser ? 'User updated successfully' : 'User created successfully');
    } catch (err: any) {
      toast.error(errorMessage(err, 'Saving user failed'));
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser) return;
    try {
      await api.post(`/users/${resetUser._id}/reset-password`, { password: newPassword });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setResetUser(null);
      setNewPassword('');
      toast.success('Password reset successfully');
    } catch (err: any) {
      toast.error(errorMessage(err, 'Password reset failed'));
    }
  };

  const handleChangeDepartmentHod = async (departmentId: string, hodUserId: string) => {
    try {
      await api.patch(`/departments/${departmentId}`, { hodUserId: hodUserId || null });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    } catch (err: any) {
      toast.error(errorMessage(err, 'Changing HOD failed'));
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/locations', {
        code: locCode.toUpperCase(),
        name: locName,
        floor: locFloor,
        zone: locZone,
        type: locType,
        departmentId: locDeptId || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setShowLocationModal(false);
      setLocCode('');
      setLocName('');
      setLocFloor('Floor 1');
      setLocZone('Zone-1');
      setLocType('ROOM');
      setLocDeptId('');
      toast.success('Location created successfully');
    } catch (err: any) {
      toast.error(errorMessage(err, 'Location creation failed'));
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/departments', {
        code: deptCode.toUpperCase(),
        name: deptName,
        category: deptCategory || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setShowDeptModal(false);
      setDeptCode('');
      setDeptName('');
      setDeptCategory('');
      toast.success('Department created successfully');
    } catch (err: any) {
      toast.error(errorMessage(err, 'Department creation failed'));
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const subArr = categorySubcategories
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((subNameStr) => ({
          name: subNameStr,
          code: subNameStr.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
          active: true,
        }));

      await api.post('/categories', {
        code: categoryCode.toUpperCase(),
        name: categoryName,
        domain: categoryDomain.trim() || undefined,
        order: categories.length + 1,
        subcategories: subArr,
      });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setShowCategoryModal(false);
      setCategoryCode('');
      setCategoryName('');
      setCategoryDomain('');
      setCategorySubcategories('');
      toast.success('Incident category created successfully!');
    } catch (err: any) {
      toast.error(errorMessage(err, 'Category creation failed'));
    }
  };

  const handleAddSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCategory) return;
    try {
      await api.post(`/categories/${targetCategory._id}/subcategories`, {
        name: subName.trim(),
        code: subCode.trim() ? subCode.toUpperCase() : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setShowSubModal(false);
      setSubName('');
      setSubCode('');
      setTargetCategory(null);
      toast.success('Subcategory added successfully!');
    } catch (err: any) {
      toast.error(errorMessage(err, 'Subcategory creation failed'));
    }
  };

  return (
    <div className="space-y-6 text-clinicalText-primary">
      {/* Title Card - dark theme */}
      <div className="bg-gradient-to-r from-[#241014] via-[#1B0E11] to-[#150A0C] p-6 rounded-2xl border border-[#3D1B1F] shadow-[0_4px_20px_rgba(0,0,0,0.25)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-start space-x-2">
            <Settings className="w-6 h-6 shrink-0 mt-0.5 text-[#F06B70]" />
            <span>Master Administration & Configurations</span>
          </h2>
          <p className="text-xs text-slate-300/80 mt-1">
            Manage users and their roles, departments and their HODs, locations, and incident categories.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative bg-white border border-clinicalBorder shadow-sm rounded-xl px-2 flex space-x-1 overflow-x-auto">
        <span
          className="absolute top-0 bottom-0 rounded-t-xl bg-[#FFF5F5] border-b-[3px] border-[#8B1E23] shadow-xs transition-all duration-300 ease-out"
          style={indicatorStyle}
        />
        {[
          { id: 'users', label: `User Directory (${users.length})` },
          { id: 'departments', label: `Departments (${departments.length})` },
          { id: 'locations', label: `Locations (${locations.length})` },
          { id: 'categories', label: `Categories (${categories.length})` },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={registerTab(tab.id)}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative z-10 px-5 py-3 text-xs rounded-t-xl transition-colors duration-200 cursor-pointer whitespace-nowrap ${
                isActive ? 'text-[#8B1E23] font-bold' : 'text-[#64748B] hover:text-[#8B1E23] font-semibold'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Users */}
      {activeTab === 'users' && (
        <div key="users" className="space-y-4 animate-tab-panel-in">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search name, username, email, employee ID"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="px-3 py-2 bg-white border border-clinicalBorder rounded-lg text-xs w-72 focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 transition"
              />
              <SearchableSelect
                value={roleFilter}
                onChange={setRoleFilter}
                options={[{ value: '', label: 'All roles' }, ...roles.map((r: any) => ({ value: r.code, label: r.name }))]}
                searchPlaceholder="Search roles..."
                className="px-3 py-2 bg-white border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 transition"
              />
            </div>
            <div className="flex items-center space-x-2 self-start">
              <button
                type="button"
                onClick={() => {
                  setShowBulkImportModal(true);
                  setBulkImportResult(null);
                }}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 text-maroon-700 border border-maroon-200 font-semibold text-xs rounded-xl shadow-sm hover:shadow flex items-center space-x-2 transition cursor-pointer"
              >
                <Upload className="w-4 h-4 text-maroon-700" />
                <span>Bulk Import (CSV)</span>
              </button>
              <button
                onClick={openCreateUser}
                className="group relative overflow-hidden px-5 py-2.5 bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] hover:from-[#7A1A1E] hover:via-[#8B1E23] hover:to-[#B71C1C] active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg flex items-center space-x-2 transition-all duration-200 cursor-pointer"
              >
                <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-xl" />
                <span className="relative z-10 flex items-center space-x-2">
                  <PlusCircle className="w-4 h-4 text-white" />
                  <span>Add New User</span>
                </span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-clinicalBorder shadow-card overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-clinicalBorder font-bold uppercase text-[11px] tracking-wider text-clinicalText-secondary">
                <tr>
                  <th className="py-3 px-4">Emp ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Username / Email</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u: any) => {
                  const isDeptHod = departments.some((d: any) => d.hodUserId?._id === u._id);
                  return (
                    <tr key={u._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-maroon-700">{u.employeeId}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-clinicalText-primary">{u.name}</div>
                        <div className="text-[11px] text-clinicalText-muted">{u.designation}</div>
                      </td>
                      <td className="py-3 px-4 text-clinicalText-secondary">{u.username} ({u.email})</td>
                      <td className="py-3 px-4 text-clinicalText-secondary">{u.departmentId?.name || '—'}</td>
                      <td className="py-3 px-4">
                        {u.roles?.map((r: any) => (
                          <span key={r._id} className="px-2 py-0.5 rounded bg-brandRed-50 text-maroon-700 border border-brandRed-200 font-semibold text-[10px] mr-1">
                            {r.name}
                          </span>
                        ))}
                        {isDeptHod && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-[10px]">
                            Dept HOD
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded border font-bold text-[10px] ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditUser(u)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-clinicalText-primary bg-white hover:bg-slate-50 border border-clinicalBorder rounded-lg transition cursor-pointer mr-1"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetUser(u);
                            setNewPassword('');
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-maroon-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition cursor-pointer"
                        >
                          Reset Password
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-clinicalText-muted">No users match the filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Departments */}
      {activeTab === 'departments' && (
        <div key="departments" className="space-y-4 animate-tab-panel-in">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search name or code"
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                className="px-3 py-2 bg-white border border-clinicalBorder rounded-lg text-xs w-64 focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 transition"
              />
              <SearchableSelect
                value={deptCategoryFilter}
                onChange={setDeptCategoryFilter}
                options={[
                  { value: '', label: `All categories (${departments.length})` },
                  ...departmentCategories.map((c) => ({ value: c, label: c })),
                ]}
                searchPlaceholder="Search categories..."
                className="px-3 py-2 bg-white border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 transition"
              />
            </div>
            <button
              onClick={() => setShowDeptModal(true)}
              className="group relative overflow-hidden px-5 py-2.5 bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] hover:from-[#7A1A1E] hover:via-[#8B1E23] hover:to-[#B71C1C] active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg flex items-center space-x-2 transition-all duration-200 cursor-pointer"
            >
              <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-xl" />
              <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              <span className="relative z-10 flex items-center space-x-2">
                <PlusCircle className="w-4 h-4 text-white" />
                <span>Add Department</span>
              </span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-clinicalBorder shadow-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-clinicalBorder font-bold uppercase text-[11px] tracking-wider text-clinicalText-secondary">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Department Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Assigned HOD</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDepartments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-clinicalText-muted">No departments match the filter.</td>
                  </tr>
                )}
                {filteredDepartments.map((d: any) => (
                  <tr key={d._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-maroon-700">{d.code}</td>
                    <td className="py-3 px-4 font-semibold text-clinicalText-primary">{d.name}</td>
                    <td className="py-3 px-4 text-clinicalText-secondary">{d.category || '—'}</td>
                    <td className="py-3 px-4">
                      <SearchableSelect
                        value={d.hodUserId?._id || ''}
                        onChange={(v) => handleChangeDepartmentHod(d._id, v)}
                        options={[
                          { value: '', label: '— No HOD (incidents cannot be assigned) —' },
                          ...hodsFor(d._id).map((u: any) => ({ value: u._id, label: u.name })),
                        ]}
                        searchPlaceholder="Search HODs..."
                        className={`px-2 py-1 border rounded-lg text-xs ${
                          d.hodUserId ? 'bg-white border-clinicalBorder' : 'bg-amber-50 border-amber-300 text-amber-800'
                        }`}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                        {d.active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Locations */}
      {activeTab === 'locations' && (
        <div key="locations" className="space-y-4 animate-tab-panel-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-clinicalBorder">
            <div>
              <div className="font-bold text-xs text-clinicalText-primary flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-maroon-700" />
                <span>Hospital Locations ({locations.length} Total across 5 Floors & 3 Zones)</span>
              </div>
              <p className="text-[11px] text-clinicalText-muted mt-0.5">
                Organized hierarchy: 5 Floors &bull; 3 Zones (Zone-1, Zone-B, Zone-C) &bull; Clinical departments.
              </p>
            </div>
            <button
              onClick={() => setShowLocationModal(true)}
              className="group relative overflow-hidden px-5 py-2.5 bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] hover:from-[#7A1A1E] hover:via-[#8B1E23] hover:to-[#B71C1C] active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg flex items-center space-x-2 transition-all duration-200 cursor-pointer self-start sm:self-auto"
            >
              <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-xl" />
              <span className="relative z-10 flex items-center space-x-2">
                <PlusCircle className="w-4 h-4 text-white" />
                <span>Add Location</span>
              </span>
            </button>
          </div>

          {/* Search & Floor/Zone Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-xl border border-clinicalBorder shadow-sm">
            <div className="flex-1 w-full sm:max-w-xs">
              <input
                type="text"
                placeholder="Search location code, name, department..."
                value={locSearch}
                onChange={(e) => setLocSearch(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <SearchableSelect
                value={locFloorFilter}
                onChange={setLocFloorFilter}
                options={[
                  { value: '', label: `All Floors (${locations.length})` },
                  ...FLOORS.map((f) => ({ value: f, label: `${f} (${locations.filter((l: any) => l.floor === f).length})` })),
                ]}
                searchPlaceholder="Search floors..."
                className="px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />

              <SearchableSelect
                value={locZoneFilter}
                onChange={setLocZoneFilter}
                options={[
                  { value: '', label: 'All Zones' },
                  ...ZONES.map((z) => ({ value: z, label: `${z} (${locations.filter((l: any) => l.zone === z).length})` })),
                ]}
                searchPlaceholder="Search zones..."
                className="px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />

              {(locSearch || locFloorFilter || locZoneFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setLocSearch('');
                    setLocFloorFilter('');
                    setLocZoneFilter('');
                  }}
                  className="px-2 py-1 text-xs text-clinicalText-muted hover:text-maroon-700 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-clinicalBorder shadow-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-clinicalBorder font-bold uppercase text-[11px] tracking-wider text-clinicalText-secondary">
                <tr>
                  <th className="py-3 px-4 w-36">Code</th>
                  <th className="py-3 px-4 w-32">Floor</th>
                  <th className="py-3 px-4 w-28">Zone</th>
                  <th className="py-3 px-4">Location Name</th>
                  <th className="py-3 px-4 w-24">Type</th>
                  <th className="py-3 px-4">Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLocations.map((l: any) => (
                  <tr key={l._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-maroon-700">{l.code}</td>
                    <td className="py-3 px-4">
                      {l.floor ? (
                        <span className="px-2 py-0.5 rounded font-semibold bg-red-50 text-maroon-700 border border-red-100 text-[11px]">
                          {l.floor}
                        </span>
                      ) : (
                        <span className="text-clinicalText-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {l.zone ? (
                        <span className="px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                          {l.zone}
                        </span>
                      ) : (
                        <span className="text-clinicalText-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-clinicalText-primary">{l.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-clinicalText-primary font-bold text-[10px]">
                        {l.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-clinicalText-secondary">{l.departmentId?.name || 'Hospital Wide'}</td>
                  </tr>
                ))}
                {filteredLocations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-clinicalText-muted text-xs">
                      No locations found matching your filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Categories */}
      {activeTab === 'categories' && (
        <div key="categories" className="space-y-4 animate-tab-panel-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-clinicalBorder">
            <div>
              <div className="font-bold text-xs text-clinicalText-primary flex items-center space-x-2">
                <Tag className="w-4 h-4 text-maroon-700" />
                <span>Incident Categories & Subcategories ({categories.length} Categories)</span>
              </div>
              <p className="text-[11px] text-clinicalText-muted mt-0.5">
                Standardized NABH hospital classification taxonomy with specialized subcategories across 5 clinical & operational domains.
              </p>
            </div>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="group relative overflow-hidden px-4 py-2 bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] hover:from-[#7A1A1E] hover:via-[#8B1E23] hover:to-[#B71C1C] active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg flex items-center space-x-1.5 transition-all duration-200 cursor-pointer self-start sm:self-auto"
            >
              <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-xl" />
              <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              <span className="relative z-10 flex items-center space-x-1.5">
                <PlusCircle className="w-4 h-4 text-white" />
                <span>Add Category</span>
              </span>
            </button>
          </div>

          {/* Search & Domain Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-xl border border-clinicalBorder shadow-sm">
            <div className="flex-1 w-full sm:max-w-xs">
              <input
                type="text"
                placeholder="Search category, code, or subcategory..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
            </div>
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <label className="text-xs text-clinicalText-muted font-medium whitespace-nowrap">Filter Domain:</label>
              <SearchableSelect
                value={categoryDomainFilter}
                onChange={setCategoryDomainFilter}
                options={[
                  { value: '', label: `All Domains (${categories.length})` },
                  ...categoryDomains.map((dom) => ({
                    value: dom,
                    label: `${dom} (${categories.filter((c: any) => c.domain === dom).length})`,
                  })),
                ]}
                searchPlaceholder="Search domains..."
                className="px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
              {(categorySearch || categoryDomainFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setCategorySearch('');
                    setCategoryDomainFilter('');
                  }}
                  className="px-2 py-1 text-xs text-clinicalText-muted hover:text-maroon-700 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-clinicalBorder shadow-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-clinicalBorder font-bold uppercase text-[11px] tracking-wider text-clinicalText-secondary">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 w-44">Code</th>
                  <th className="py-3 px-4 w-72">Category & Domain</th>
                  <th className="py-3 px-4">Subcategories ({filteredCategories.reduce((acc: number, c: any) => acc + (c.subcategories?.length || 0), 0)})</th>
                  <th className="py-3 px-4 w-28 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map((c: any, index: number) => (
                  <tr key={c._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 text-center font-bold text-clinicalText-muted">
                      {c.order || index + 1}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-maroon-700">{c.code}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-clinicalText-primary">{c.name}</div>
                      {c.domain && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-maroon-700 border border-red-100">
                          {c.domain}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {c.subcategories?.map((sc: any) => (
                          <span
                            key={sc.code}
                            className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-clinicalText-secondary text-[11px]"
                          >
                            {sc.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetCategory(c);
                          setShowSubModal(true);
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold text-maroon-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition cursor-pointer"
                        title="Add subcategory to this category"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Sub</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCategories.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-clinicalText-muted text-xs">
                      No categories found matching your filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Create / Edit Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form onSubmit={handleSaveUser} className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-3 shadow-2xl border border-clinicalBorder">
            <h3 className="font-bold text-clinicalText-primary">{editingUser ? `Edit User — ${editingUser.username}` : 'Add New User'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Role *</label>
                <SearchableSelect
                  value={roleId}
                  onChange={setRoleId}
                  options={[
                    { value: '', label: '-- Choose Role --' },
                    ...roles.map((r: any) => ({ value: r._id, label: r.name })),
                  ]}
                  searchPlaceholder="Search roles..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Employee ID *</label>
                <input type="text" required disabled={Boolean(editingUser)} value={empId} onChange={(e) => setEmpId(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition disabled:opacity-60" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Username *</label>
                <input type="text" required disabled={Boolean(editingUser)} value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition disabled:opacity-60" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Full Name *</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Email *</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition" />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Initial Password * (min 8)</label>
                  <input type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition" />
                </div>
              )}
              {roleId && (
                <div>
                  <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">
                    Department {needsDepartment ? '*' : '(optional)'}
                  </label>
                  <SearchableSelect
                    value={deptId}
                    onChange={setDeptId}
                    options={[{ value: '', label: '-- Choose Department --' }, ...departmentOptions(departments)]}
                    searchPlaceholder="Search departments..."
                    className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
                  />
                </div>
              )}
              {roleId && (
                <div>
                  <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">
                    Designation {isHodRole ? '*' : '(optional)'}
                  </label>
                  <input type="text" required={isHodRole} value={designation} onChange={(e) => setDesignation(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition" />
                </div>
              )}
              {isHodRole && (
                <div>
                  <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">WhatsApp Number *</label>
                  <input type="tel" required value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="e.g. +91 98765 43210" className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition" />
                </div>
              )}
              {editingUser && (
                <div>
                  <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Status</label>
                  <SearchableSelect
                    value={userStatus}
                    onChange={setUserStatus}
                    options={[
                      { value: 'ACTIVE', label: 'ACTIVE' },
                      { value: 'INACTIVE', label: 'INACTIVE' },
                      { value: 'LOCKED', label: 'LOCKED' },
                    ]}
                    searchPlaceholder="Search status..."
                    className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
                  />
                </div>
              )}
            </div>
            {hodConflict && (
              <label className="flex items-start space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <input type="checkbox" checked={replaceHod} onChange={(e) => setReplaceHod(e.target.checked)} className="mt-0.5" />
                <span>
                  {selectedDept?.name} already has an HOD ({currentDeptHod?.name}). Tick to replace them with this user as the
                  department HOD.
                </span>
              </label>
            )}
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2 bg-white hover:bg-slate-50 text-clinicalText-secondary hover:text-clinicalText-primary border border-clinicalBorder font-medium text-xs rounded-xl transition cursor-pointer">Cancel</button>
              <button
                type="submit"
                className="group relative overflow-hidden px-5 py-2 bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] hover:from-[#7A1A1E] hover:via-[#8B1E23] hover:to-[#B71C1C] active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg transition-all duration-200 cursor-pointer"
              >
                <span className="relative z-10">{editingUser ? 'Save Changes' : 'Create User'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleResetPassword} className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-3 shadow-2xl border border-clinicalBorder">
            <h3 className="font-bold text-clinicalText-primary">Reset Password — {resetUser.name}</h3>
            <p className="text-xs text-clinicalText-secondary">This also unlocks the account if it was locked after failed logins.</p>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">New Password * (min 8)</label>
              <input type="text" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition" />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setResetUser(null)} className="px-4 py-2 bg-white hover:bg-slate-50 text-clinicalText-secondary border border-clinicalBorder font-medium text-xs rounded-xl transition cursor-pointer">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] text-white font-semibold text-xs rounded-xl shadow-button-red transition cursor-pointer">Reset Password</button>
            </div>
          </form>
        </div>
      )}

      {/* Location Create Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateLocation} className="bg-white rounded-2xl p-6 max-w-md w-full space-y-3 shadow-2xl border border-clinicalBorder">
            <h3 className="font-bold text-clinicalText-primary">Add New Location</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Hospital Floor *</label>
                <SearchableSelect
                  value={locFloor}
                  onChange={(f) => {
                    setLocFloor(f);
                    const fNum = f.replace(/[^0-9]/g, '');
                    const zCode = locZone === 'Zone-1' ? 'Z1' : locZone === 'Zone-B' ? 'ZB' : 'ZC';
                    if (!locCode || locCode.startsWith('FL')) {
                      setLocCode(`FL${fNum}-${zCode}`);
                    }
                  }}
                  options={FLOORS.map((f) => ({ value: f, label: f }))}
                  searchPlaceholder="Search floors..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Zone *</label>
                <SearchableSelect
                  value={locZone}
                  onChange={(z) => {
                    setLocZone(z);
                    const fNum = locFloor.replace(/[^0-9]/g, '');
                    const zCode = z === 'Zone-1' ? 'Z1' : z === 'Zone-B' ? 'ZB' : 'ZC';
                    if (!locCode || locCode.startsWith('FL')) {
                      setLocCode(`FL${fNum}-${zCode}`);
                    }
                  }}
                  options={ZONES.map((z) => ({ value: z, label: z }))}
                  searchPlaceholder="Search zones..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Location Code *</label>
              <input type="text" required placeholder="e.g. FL1-Z1 or ICU-BED-03" value={locCode} onChange={(e) => setLocCode(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Location / Room Name *</label>
              <input type="text" required placeholder="e.g. Floor 1 - Zone-1 or ICU Bed 03" value={locName} onChange={(e) => setLocName(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Type *</label>
              <SearchableSelect
                value={locType}
                onChange={setLocType}
                options={LOCATION_TYPES.map((t) => ({ value: t, label: t }))}
                searchPlaceholder="Search types..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Department</label>
              <SearchableSelect
                value={locDeptId}
                onChange={setLocDeptId}
                options={[{ value: '', label: 'Hospital-wide' }, ...departmentOptions(departments)]}
                searchPlaceholder="Search departments..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setShowLocationModal(false)} className="px-4 py-2 bg-white hover:bg-slate-50 text-clinicalText-secondary border border-clinicalBorder font-medium text-xs rounded-xl transition cursor-pointer">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] text-white font-semibold text-xs rounded-xl shadow-button-red transition cursor-pointer">Create Location</button>
            </div>
          </form>
        </div>
      )}

      {/* Dept Create Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateDepartment} className="bg-white rounded-2xl p-6 max-w-md w-full space-y-3 shadow-2xl border border-clinicalBorder">
            <h3 className="font-bold text-clinicalText-primary">Add New Department</h3>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Department Code *</label>
              <input type="text" required placeholder="e.g. ICU" value={deptCode} onChange={(e) => setDeptCode(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Department Name *</label>
              <input type="text" required placeholder="e.g. Intensive Care Unit" value={deptName} onChange={(e) => setDeptName(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Category</label>
              <SearchableSelect
                value={deptCategory}
                onChange={setDeptCategory}
                options={[{ value: '', label: '— None —' }, ...DEPARTMENT_CATEGORIES.map((c) => ({ value: c, label: c }))]}
                searchPlaceholder="Search categories..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setShowDeptModal(false)} className="px-4 py-2 bg-white hover:bg-slate-50 text-clinicalText-secondary hover:text-clinicalText-primary border border-clinicalBorder font-medium text-xs rounded-xl transition cursor-pointer">Cancel</button>
              <button
                type="submit"
                className="group relative overflow-hidden px-5 py-2 bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] hover:from-[#7A1A1E] hover:via-[#8B1E23] hover:to-[#B71C1C] active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg transition-all duration-200 cursor-pointer"
              >
                <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-xl" />
                <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                <span className="relative z-10">Create Dept</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category Create Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateCategory}
            className="bg-white rounded-2xl p-6 max-w-md w-full space-y-3 shadow-2xl border border-clinicalBorder"
          >
            <h3 className="font-bold text-clinicalText-primary">Add New Incident Category</h3>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Category Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. PATIENT_SAFETY"
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Category Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Patient Fall"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Domain / Grouping</label>
              <input
                type="text"
                list="domain-options"
                placeholder="e.g. 1. Clinical and Patient-Care Incidents"
                value={categoryDomain}
                onChange={(e) => setCategoryDomain(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
              <datalist id="domain-options">
                {categoryDomains.map((d: string) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">
                Subcategories (Comma separated)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Near Fall, Fall Without Injury, Fall With Injury"
                value={categorySubcategories}
                onChange={(e) => setCategorySubcategories(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-clinicalText-secondary hover:text-clinicalText-primary border border-clinicalBorder font-medium text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="group relative overflow-hidden px-5 py-2 bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] hover:from-[#7A1A1E] hover:via-[#8B1E23] hover:to-[#B71C1C] active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg transition-all duration-200 cursor-pointer"
              >
                <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-xl" />
                <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                <span className="relative z-10">Create Category</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subcategory Add Modal */}
      {showSubModal && targetCategory && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAddSubcategory}
            className="bg-white rounded-2xl p-6 max-w-md w-full space-y-3 shadow-2xl border border-clinicalBorder"
          >
            <h3 className="font-bold text-clinicalText-primary">
              Add Subcategory to {targetCategory.name}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Subcategory Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Near Fall"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">
                Subcategory Code (Optional)
              </label>
              <input
                type="text"
                placeholder="Auto-generated if blank (e.g. NEAR_FALL)"
                value={subCode}
                onChange={(e) => setSubCode(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSubModal(false);
                  setTargetCategory(null);
                }}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-clinicalText-secondary hover:text-clinicalText-primary border border-clinicalBorder font-medium text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="group relative overflow-hidden px-5 py-2 bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] hover:from-[#7A1A1E] hover:via-[#8B1E23] hover:to-[#B71C1C] active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg transition-all duration-200 cursor-pointer"
              >
                <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-xl" />
                <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                <span className="relative z-10">Add Subcategory</span>
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Bulk Import CSV Modal */}
      {showBulkImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl border border-clinicalBorder my-8">
            <div className="flex items-center justify-between pb-3 border-b border-clinicalBorder">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-maroon-700 flex items-center justify-center font-bold">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-clinicalText-primary">Staff Accounts Bulk Import</h3>
                  <p className="text-[11px] text-clinicalText-secondary">Upload an HR roster CSV file or paste formatted rows</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkImportModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Template Download and Instructions */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs text-clinicalText-secondary">
                <FileText className="w-4 h-4 text-maroon-700 flex-shrink-0" />
                <span>Required columns: <code className="text-maroon-700 font-semibold">employeeId, name, email, username, departmentCode, roleCode</code></span>
              </div>
              <button
                type="button"
                onClick={downloadSampleCsv}
                className="flex items-center space-x-1.5 text-xs font-semibold text-maroon-700 hover:text-maroon-800 bg-white border border-brandRed-200 px-3 py-1.5 rounded-lg shadow-xs hover:bg-red-50 transition cursor-pointer flex-shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Template</span>
              </button>
            </div>

            {/* Upload or Paste */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">
                  1. Select CSV File from Device
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brandRed-50 file:text-maroon-700 hover:file:bg-brandRed-100 cursor-pointer border border-clinicalBorder rounded-lg p-1 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">
                  Or Paste CSV Text
                </label>
                <textarea
                  rows={4}
                  value={csvRawText}
                  onChange={handleCsvTextareaChange}
                  placeholder="employeeId,name,email,username,departmentCode,roleCode,designation&#10;EMP101,Dr. John Doe,john@hospital.org,john.doe,EMERGENCY,STAFF,Medical Officer"
                  className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs font-mono focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="bulkUpdate"
                  checked={bulkUpdateExisting}
                  onChange={(e) => setBulkUpdateExisting(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-maroon-600 focus:ring-brandRed-500 cursor-pointer"
                />
                <label htmlFor="bulkUpdate" className="text-xs text-clinicalText-secondary cursor-pointer">
                  Update existing accounts if matching Employee ID, Email, or Username is found
                </label>
              </div>
            </div>

            {/* Preview Section */}
            {bulkParsedRows.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-clinicalText-primary">
                    Preview Data ({bulkParsedRows.length} rows detected)
                  </span>
                  <span className="text-[11px] text-clinicalText-muted">
                    Showing top {Math.min(bulkParsedRows.length, 5)} rows
                  </span>
                </div>
                <div className="border border-clinicalBorder rounded-xl overflow-hidden overflow-x-auto max-h-40">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 border-b border-clinicalBorder text-clinicalText-secondary uppercase">
                      <tr>
                        <th className="py-1.5 px-3">Emp ID</th>
                        <th className="py-1.5 px-3">Name</th>
                        <th className="py-1.5 px-3">Username</th>
                        <th className="py-1.5 px-3">Dept</th>
                        <th className="py-1.5 px-3">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {bulkParsedRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 px-3 font-mono text-maroon-700 font-semibold">{row.employeeId}</td>
                          <td className="py-1.5 px-3">{row.name}</td>
                          <td className="py-1.5 px-3 text-slate-500">{row.username}</td>
                          <td className="py-1.5 px-3">{row.departmentCode || '—'}</td>
                          <td className="py-1.5 px-3 font-semibold text-slate-700">{row.roleCode || 'STAFF'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Result Display */}
            {bulkImportResult && (
              <div className={`p-3 rounded-xl border text-xs space-y-2 ${
                bulkImportResult.failed > 0
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div className="flex items-center space-x-2 font-bold">
                  {bulkImportResult.failed > 0 ? (
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>Import Completed</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-white/80 p-1.5 rounded border border-current/20">
                    <span className="block text-slate-500">Imported</span>
                    <span className="font-bold text-emerald-700 text-sm">{bulkImportResult.imported}</span>
                  </div>
                  <div className="bg-white/80 p-1.5 rounded border border-current/20">
                    <span className="block text-slate-500">Updated</span>
                    <span className="font-bold text-blue-700 text-sm">{bulkImportResult.updated}</span>
                  </div>
                  <div className="bg-white/80 p-1.5 rounded border border-current/20">
                    <span className="block text-slate-500">Skipped</span>
                    <span className="font-bold text-slate-700 text-sm">{bulkImportResult.skipped}</span>
                  </div>
                  <div className="bg-white/80 p-1.5 rounded border border-current/20">
                    <span className="block text-slate-500">Failed</span>
                    <span className="font-bold text-red-700 text-sm">{bulkImportResult.failed}</span>
                  </div>
                </div>
                {bulkImportResult.errors?.length > 0 && (
                  <div className="mt-2 text-[11px] text-red-700 max-h-24 overflow-y-auto space-y-1">
                    <span className="font-semibold block">Row Errors:</span>
                    {bulkImportResult.errors.map((e: any, idx: number) => (
                      <div key={idx} className="bg-white/90 p-1 rounded border border-red-200">
                        Row {e.row} ({e.employeeId}): {e.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t border-clinicalBorder">
              <button
                type="button"
                onClick={() => setShowBulkImportModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-clinicalText-secondary hover:text-clinicalText-primary border border-clinicalBorder font-medium text-xs rounded-xl transition cursor-pointer"
              >
                {bulkImportResult ? 'Close' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={bulkImportLoading || bulkParsedRows.length === 0}
                onClick={handleExecuteBulkImport}
                className="group relative overflow-hidden px-5 py-2 bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] hover:from-[#7A1A1E] hover:via-[#8B1E23] hover:to-[#B71C1C] disabled:opacity-50 active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg transition-all duration-200 cursor-pointer"
              >
                <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-xl" />
                <span className="relative z-10 flex items-center space-x-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{bulkImportLoading ? 'Importing...' : `Import ${bulkParsedRows.length} Accounts`}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
