import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Users, Building, MapPin, Tag, PlusCircle, Plus } from 'lucide-react';
import { api } from '../lib/api';

export default function AdminMasterPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'locations' | 'categories'>('users');

  // User form state
  const [showUserModal, setShowUserModal] = useState(false);
  const [empId, setEmpId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('Staff@123');
  const [deptId, setDeptId] = useState('');

  // Department form state
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');

  // Category form state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryCode, setCategoryCode] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categorySubcategories, setCategorySubcategories] = useState('');

  // Subcategory form state
  const [showSubModal, setShowSubModal] = useState(false);
  const [targetCategory, setTargetCategory] = useState<any>(null);
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');

  // Queries
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
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

  const users = (usersData as any)?.data || [];
  const departments = (departmentsData as any)?.data || [];
  const locations = (locationsData as any)?.data || [];
  const categories = (categoriesData as any)?.data || [];

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Find staff role ID
      const rolesRes: any = await api.get('/roles');
      const staffRole = rolesRes.data?.find((r: any) => r.code === 'STAFF');

      await api.post('/users', {
        employeeId: empId,
        name,
        email,
        username,
        password,
        departmentId: deptId || undefined,
        roles: [staffRole?._id],
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowUserModal(false);
      alert('User created successfully');
    } catch (err: any) {
      alert(err?.message || 'User creation failed');
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/departments', {
        code: deptCode.toUpperCase(),
        name: deptName,
      });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setShowDeptModal(false);
      alert('Department created successfully');
    } catch (err: any) {
      alert(err?.message || 'Department creation failed');
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
        order: categories.length + 1,
        subcategories: subArr,
      });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setShowCategoryModal(false);
      setCategoryCode('');
      setCategoryName('');
      setCategorySubcategories('');
      alert('Incident category created successfully!');
    } catch (err: any) {
      alert(err?.message || 'Category creation failed');
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
      alert('Subcategory added successfully!');
    } catch (err: any) {
      alert(err?.message || 'Subcategory creation failed');
    }
  };

  return (
    <div className="space-y-6 text-clinicalText-primary">
      {/* Title Card - Separate floating box with light red tint on the left */}
      <div className="bg-gradient-to-r from-[#FDECEC]/70 via-[#FFFBFB] to-white p-6 rounded-2xl border border-clinicalBorder border-l-4 border-l-[#8B1E23] shadow-[0_4px_20px_rgba(15,23,42,0.06)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-clinicalText-primary flex items-center space-x-2">
            <Settings className="w-6 h-6 text-maroon-700" />
            <span>Master Administration & Configurations</span>
          </h2>
          <p className="text-xs text-clinicalText-secondary mt-1">
            Manage hospital users, roles, departments, locations, and incident categories.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-clinicalBorder shadow-sm rounded-xl px-2 flex space-x-1 overflow-x-auto">
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
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-3 text-xs rounded-t-xl transition-all duration-150 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-b-[3px] border-[#8B1E23] text-[#8B1E23] bg-[#FFF5F5] font-bold shadow-xs'
                  : 'border-b-[3px] border-transparent text-[#64748B] hover:text-[#8B1E23] hover:bg-[#FFF5F5] hover:border-[#8B1E23]/30 font-semibold'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Users */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowUserModal(true)}
              className="group relative overflow-hidden px-5 py-2.5 bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] hover:from-[#7A1A1E] hover:via-[#8B1E23] hover:to-[#B71C1C] active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg flex items-center space-x-2 transition-all duration-200 cursor-pointer"
            >
              <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-xl" />
              <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              <span className="relative z-10 flex items-center space-x-2">
                <PlusCircle className="w-4 h-4 text-white" />
                <span>Add New User</span>
              </span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-clinicalBorder shadow-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-clinicalBorder font-bold uppercase text-[11px] tracking-wider text-clinicalText-secondary">
                <tr>
                  <th className="py-3 px-4">Emp ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Username / Email</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Role(s)</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u: any) => (
                  <tr key={u._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-maroon-700">{u.employeeId}</td>
                    <td className="py-3 px-4 font-semibold text-clinicalText-primary">{u.name}</td>
                    <td className="py-3 px-4 text-clinicalText-secondary">{u.username} ({u.email})</td>
                    <td className="py-3 px-4 text-clinicalText-secondary">{u.departmentId?.name || 'N/A'}</td>
                    <td className="py-3 px-4">
                      {u.roles?.map((r: any) => (
                        <span key={r._id} className="px-2 py-0.5 rounded bg-brandRed-50 text-maroon-700 border border-brandRed-200 font-semibold text-[10px] mr-1">
                          {r.name}
                        </span>
                      ))}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Departments */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex justify-end">
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
                  <th className="py-3 px-4">Assigned HOD</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((d: any) => (
                  <tr key={d._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-maroon-700">{d.code}</td>
                    <td className="py-3 px-4 font-semibold text-clinicalText-primary">{d.name}</td>
                    <td className="py-3 px-4 text-clinicalText-secondary">{d.hodUserId?.name || 'Unassigned'}</td>
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
        <div className="bg-white rounded-2xl border border-clinicalBorder shadow-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-clinicalBorder font-bold uppercase text-[11px] tracking-wider text-clinicalText-secondary">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Location Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Department</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {locations.map((l: any) => (
                <tr key={l._id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-mono font-bold text-maroon-700">{l.code}</td>
                  <td className="py-3 px-4 font-semibold text-clinicalText-primary">{l.name}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 rounded bg-slate-100 text-clinicalText-primary font-bold text-[10px]">{l.type}</span></td>
                  <td className="py-3 px-4 text-clinicalText-secondary">{l.departmentId?.name || 'Hospital Wide'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Categories */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-clinicalBorder">
            <div>
              <div className="font-bold text-xs text-clinicalText-primary flex items-center space-x-2">
                <Tag className="w-4 h-4 text-maroon-700" />
                <span>Incident Categories & Subcategories ({categories.length} Categories)</span>
              </div>
              <p className="text-[11px] text-clinicalText-muted mt-0.5">
                Standardized NABH hospital classification taxonomy with specialized subcategories.
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

          <div className="bg-white rounded-2xl border border-clinicalBorder shadow-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-clinicalBorder font-bold uppercase text-[11px] tracking-wider text-clinicalText-secondary">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 w-44">Code</th>
                  <th className="py-3 px-4 w-60">Category Name</th>
                  <th className="py-3 px-4">Subcategories</th>
                  <th className="py-3 px-4 w-28 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c: any, index: number) => (
                  <tr key={c._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 text-center font-bold text-clinicalText-muted">
                      {c.order || index + 1}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-maroon-700">{c.code}</td>
                    <td className="py-3 px-4 font-semibold text-clinicalText-primary">{c.name}</td>
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
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Create Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateUser} className="bg-white rounded-2xl p-6 max-w-md w-full space-y-3 shadow-2xl border border-clinicalBorder">
            <h3 className="font-bold text-clinicalText-primary">Add New User</h3>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Employee ID *</label>
              <input type="text" required value={empId} onChange={(e) => setEmpId(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Full Name *</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Username *</label>
              <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Email *</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Department</label>
              <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition">
                <option value="">-- Choose Department --</option>
                {departments.map((d: any) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2 bg-white hover:bg-slate-50 text-clinicalText-secondary hover:text-clinicalText-primary border border-clinicalBorder font-medium text-xs rounded-xl transition cursor-pointer">Cancel</button>
              <button
                type="submit"
                className="group relative overflow-hidden px-5 py-2 bg-gradient-to-r from-[#8B1E23] via-[#A82329] to-[#C62828] hover:from-[#7A1A1E] hover:via-[#8B1E23] hover:to-[#B71C1C] active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg transition-all duration-200 cursor-pointer"
              >
                <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-xl" />
                <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                <span className="relative z-10">Create User</span>
              </button>
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
    </div>
  );
}
