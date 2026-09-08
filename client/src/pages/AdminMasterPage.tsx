import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Users, Building, MapPin, Tag, PlusCircle } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center space-x-2">
            <Settings className="w-6 h-6 text-hospital-600" />
            <span>Master Administration & Configurations</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage hospital users, roles, departments, locations, and incident categories.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 rounded-xl px-2 flex space-x-1">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'users' ? 'border-hospital-600 text-hospital-700' : 'border-transparent text-slate-500'
          }`}
        >
          User Directory ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'departments' ? 'border-hospital-600 text-hospital-700' : 'border-transparent text-slate-500'
          }`}
        >
          Departments ({departments.length})
        </button>
        <button
          onClick={() => setActiveTab('locations')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'locations' ? 'border-hospital-600 text-hospital-700' : 'border-transparent text-slate-500'
          }`}
        >
          Locations ({locations.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'categories' ? 'border-hospital-600 text-hospital-700' : 'border-transparent text-slate-500'
          }`}
        >
          Categories ({categories.length})
        </button>
      </div>

      {/* Tab 1: Users */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowUserModal(true)}
              className="px-4 py-2 bg-hospital-600 text-white font-semibold text-xs rounded-xl shadow flex items-center space-x-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add New User</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-600">
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
                  <tr key={u._id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700">{u.employeeId}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{u.name}</td>
                    <td className="py-3 px-4 text-slate-600">{u.username} ({u.email})</td>
                    <td className="py-3 px-4 text-slate-600">{u.departmentId?.name || 'N/A'}</td>
                    <td className="py-3 px-4">
                      {u.roles?.map((r: any) => (
                        <span key={r._id} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[10px] mr-1">
                          {r.name}
                        </span>
                      ))}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
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
              className="px-4 py-2 bg-hospital-600 text-white font-semibold text-xs rounded-xl shadow flex items-center space-x-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Department</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-600">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Department Name</th>
                  <th className="py-3 px-4">Assigned HOD</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((d: any) => (
                  <tr key={d._id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-hospital-700">{d.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{d.name}</td>
                    <td className="py-3 px-4 text-slate-600">{d.hodUserId?.name || 'Unassigned'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-600">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Location Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Department</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {locations.map((l: any) => (
                <tr key={l._id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold text-hospital-700">{l.code}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{l.name}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-[10px]">{l.type}</span></td>
                  <td className="py-3 px-4 text-slate-600">{l.departmentId?.name || 'Hospital Wide'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Categories */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-600">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Category Name</th>
                <th className="py-3 px-4">Subcategories</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((c: any) => (
                <tr key={c._id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold text-hospital-700">{c.code}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{c.name}</td>
                  <td className="py-3 px-4">
                    {c.subcategories?.map((sc: any) => (
                      <span key={sc.code} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] mr-1">
                        {sc.name}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* User Create Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateUser} className="bg-white rounded-2xl p-6 max-w-md w-full space-y-3 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-slate-800">Add New User</h3>
            <div>
              <label className="block text-xs font-semibold mb-1">Employee ID *</label>
              <input type="text" required value={empId} onChange={(e) => setEmpId(e.target.value)} className="w-full px-3 py-1.5 border rounded text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Full Name *</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-1.5 border rounded text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Username *</label>
              <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-1.5 border rounded text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Email *</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-1.5 border rounded text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Department</label>
              <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="w-full px-3 py-1.5 border rounded text-xs">
                <option value="">-- Choose Department --</option>
                {departments.map((d: any) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setShowUserModal(false)} className="px-3 py-1.5 bg-slate-100 rounded text-xs font-semibold">Cancel</button>
              <button type="submit" className="px-4 py-1.5 bg-hospital-600 text-white rounded text-xs font-semibold">Create User</button>
            </div>
          </form>
        </div>
      )}

      {/* Dept Create Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateDepartment} className="bg-white rounded-2xl p-6 max-w-md w-full space-y-3 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-slate-800">Add New Department</h3>
            <div>
              <label className="block text-xs font-semibold mb-1">Department Code *</label>
              <input type="text" required placeholder="e.g. ICU" value={deptCode} onChange={(e) => setDeptCode(e.target.value)} className="w-full px-3 py-1.5 border rounded text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Department Name *</label>
              <input type="text" required placeholder="e.g. Intensive Care Unit" value={deptName} onChange={(e) => setDeptName(e.target.value)} className="w-full px-3 py-1.5 border rounded text-xs" />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={() => setShowDeptModal(false)} className="px-3 py-1.5 bg-slate-100 rounded text-xs font-semibold">Cancel</button>
              <button type="submit" className="px-4 py-1.5 bg-hospital-600 text-white rounded text-xs font-semibold">Create Dept</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
