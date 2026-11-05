import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Users, 
  Briefcase, 
  Mail, 
  Phone, 
  DollarSign, 
  Building, 
  Search, 
  User, 
  TrendingUp, 
  CheckCircle2, 
  ShieldCheck, 
  ListFilter, 
  LayoutGrid
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { Cockpit3DLoader } from '../components/common/Cockpit3DLoader';
import { formatCurrency } from '../utils/formatters';
import type { Employee, Department } from '../types';

export const HRM: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<number | 'all'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [departmentId, setDepartmentId] = useState<number>(0);
  const [salary, setSalary] = useState<number>(85000);

  const fetchData = async () => {
    try {
      const [empRes, deptRes]: any = await Promise.all([
        api.get('/hrm/employees'),
        api.get('/hrm/departments')
      ]);
      setEmployees(empRes || []);
      setDepartments(deptRes || []);
      if (deptRes && deptRes.length > 0 && !departmentId) {
        setDepartmentId(deptRes[0].id);
      }
    } catch (err) {
      console.error('Failed to load HRM records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/hrm/employees', {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        designation,
        department_id: departmentId,
        salary,
        status: 'active'
      });
      setIsModalOpen(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error adding employee');
    }
  };

  // Telemetry KPIs
  const kpis = useMemo(() => {
    const totalStaff = employees.length;
    const activeStaff = employees.filter(e => e.status === 'active').length;
    const monthlyPayroll = employees.reduce((acc, e) => acc + Number(e.salary || 0), 0);
    const avgSalary = totalStaff > 0 ? Math.round(monthlyPayroll / totalStaff) : 0;

    return {
      totalStaff,
      activeStaff,
      monthlyPayroll,
      avgSalary,
      deptCount: departments.length
    };
  }, [employees, departments]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = searchQuery.toLowerCase();
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
      const matchesSearch = fullName.includes(q) || 
        (emp.email && emp.email.toLowerCase().includes(q)) || 
        (emp.designation && emp.designation.toLowerCase().includes(q)) ||
        (emp.employee_code && emp.employee_code.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (selectedDeptFilter !== 'all') {
        return emp.department_id === selectedDeptFilter;
      }
      return true;
    });
  }, [employees, searchQuery, selectedDeptFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Cockpit3DLoader 
          variant="module"
          size="lg"
          text="Loading Staff Directory & Payroll..."
          subtitle="Compiling employee records, departments, and payroll telemetry"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Telemetry KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Staff */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:border-slate-300 dark:hover:border-white/[0.15] transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Personnel</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
            {kpis.totalStaff}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{kpis.activeStaff} Active</span>
            <span>across all workspace teams</span>
          </div>
        </div>

        {/* Card 2: Monthly Payroll Budget */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:border-rose-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Monthly Payroll</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(kpis.monthlyPayroll)}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Committed monthly staff expenditure</span>
          </div>
        </div>

        {/* Card 3: Average Compensation */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Avg Compensation</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400 tracking-tight">
            {formatCurrency(kpis.avgSalary)}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Per employee monthly median</span>
          </div>
        </div>

        {/* Card 4: Operating Divisions */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Departments</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
            {kpis.deptCount}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Functional corporate business divisions</span>
          </div>
        </div>
      </div>

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Team & Personnel Directory</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your team roster, departmental distributions, and compensation structures
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-white dark:bg-[#0D111A] rounded-xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Table View"
            >
              <ListFilter className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Cards Roster View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="cockpit-btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Add Team Member</span>
          </button>
        </div>
      </div>

      {/* Department Quick Filter Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedDeptFilter('all')}
          className={`px-3 py-1.5 rounded-xl border whitespace-nowrap transition-all duration-180 flex items-center gap-1.5 cursor-pointer text-xs ${
            selectedDeptFilter === 'all'
              ? 'bg-[#D62839] text-white border-[#D62839] font-bold shadow-xs'
              : 'bg-white dark:bg-[#0D111A] text-slate-600 dark:text-slate-400 border-slate-200/90 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>All Departments</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
            selectedDeptFilter === 'all' ? 'bg-white/20 text-white border-white/30' : 'bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-slate-400 border-transparent'
          }`}>
            {employees.length}
          </span>
        </button>

        {departments.map((d) => {
          const isActive = selectedDeptFilter === d.id;
          const deptCount = employees.filter(e => e.department_id === d.id).length;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedDeptFilter(d.id)}
              className={`px-3 py-1.5 rounded-xl border whitespace-nowrap transition-all duration-180 flex items-center gap-1.5 cursor-pointer text-xs ${
                isActive
                  ? 'bg-[#D62839] text-white border-[#D62839] font-bold shadow-xs'
                  : 'bg-white dark:bg-[#0D111A] text-slate-600 dark:text-slate-400 border-slate-200/90 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{d.name}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                isActive ? 'bg-white/20 text-white border-white/30' : 'bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-slate-400 border-transparent'
              }`}>
                {deptCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Input Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0D111A] p-4 rounded-2xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search team member by name, role, email, or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="cockpit-input pl-10"
          />
        </div>
        <div className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
          Showing <span className="font-bold text-slate-900 dark:text-white">{filteredEmployees.length}</span> of {employees.length} team members
        </div>
      </div>

      {/* VIEW: TABLE MODE */}
      {viewMode === 'table' && (
        <div className="rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900 dark:text-white">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200/90 dark:border-white/[0.08]">
                <tr>
                  <th className="px-6 py-4">Emp Code</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Designation</th>
                  <th className="px-6 py-4 text-right">Compensation</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-white/[0.06]">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-[#D62839] dark:text-rose-400 text-xs">
                      {emp.employee_code}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 dark:text-white">{emp.first_name} {emp.last_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">{emp.email}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-medium">
                      <span className="px-2 py-0.5 rounded-lg text-xs bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08]">
                        {emp.department_name || 'General'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">
                      {emp.designation}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(Number(emp.salary))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge status={emp.status} />
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6">
                      <EmptyState
                        icon={Users}
                        title="No personnel found in directory"
                        description={employees.length === 0
                          ? "Add your first team member or specialist to begin orchestrating role assignments and payroll budgets."
                          : "No team members match your active department filter or search query."
                        }
                        primaryAction={{
                          label: "Add Team Member",
                          onClick: () => setIsModalOpen(true),
                          icon: Plus
                        }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: CARDS MODE */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => (
            <div
              key={emp.id}
              className="p-5 rounded-2xl bg-white dark:bg-[#0D111A] border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:border-slate-300 dark:hover:border-white/[0.15] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center font-bold text-[#D62839] dark:text-rose-400 text-sm">
                      {emp.first_name.charAt(0)}{emp.last_name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{emp.first_name} {emp.last_name}</h4>
                      <span className="font-mono text-xs text-[#D62839] dark:text-rose-400 font-semibold">{emp.employee_code}</span>
                    </div>
                  </div>
                  <Badge status={emp.status} />
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 mb-4">
                  <p className="flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    <span>{emp.designation}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>{emp.department_name || 'General Division'}</span>
                  </p>
                  <p className="flex items-center gap-2 font-mono">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{emp.email}</span>
                  </p>
                  {emp.phone && (
                    <p className="flex items-center gap-2 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{emp.phone}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Monthly Compensation</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">{formatCurrency(Number(emp.salary))}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD EMPLOYEE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register New Employee"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                First Name
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Aarav"
                className="cockpit-input"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Sharma"
                className="cockpit-input"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Work Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aarav@company.com"
              className="cockpit-input"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Phone Number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="cockpit-input font-mono"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Department
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(Number(e.target.value))}
                className="cockpit-input"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Designation
              </label>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Senior Engineer"
                className="cockpit-input"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Monthly Compensation (₹)
            </label>
            <input
              type="number"
              min="0"
              value={salary}
              onChange={(e) => setSalary(Number(e.target.value))}
              className="cockpit-input font-mono"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200/90 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="cockpit-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              Add Employee
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default HRM;
