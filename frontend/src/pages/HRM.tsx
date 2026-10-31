import React, { useState, useEffect } from 'react';
import { Plus, Users, Briefcase, Mail, Phone, DollarSign, Building, Search, User } from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import type { Employee, Department } from '../types';

export const HRM: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    return fullName.includes(q) || (emp.email && emp.email.toLowerCase().includes(q)) || (emp.designation && emp.designation.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#20242C] tracking-tight">Team & Personnel Directory</h2>
          <p className="text-sm text-[#667085] mt-0.5">
            Manage your team roster, departmental distributions, and compensation structures
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="cockpit-btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span>Add Team Member</span>
        </button>
      </div>

      {/* Departments Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {departments.map((d) => (
          <div key={d.id} className="p-5 rounded-2xl bg-white border border-[#E9EAEE] shadow-xs hover:border-[#FECDD3] transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#667085]">{d.name}</span>
              <span className="px-2.5 py-1 rounded-full bg-[#FFF1F2] text-[#D62839] text-xs font-semibold font-mono border border-[#FECDD3]">
                {d.employee_count || 0} Staff
              </span>
            </div>
            <p className="text-xs text-[#667085] mt-2 line-clamp-1">{d.description || 'Core Organizational Division'}</p>
          </div>
        ))}
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E9EAEE] shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search team member by name, role, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="cockpit-input pl-10"
          />
        </div>
        <div className="text-xs font-medium text-[#667085]">
          Showing {filteredEmployees.length} of {employees.length} team members
        </div>
      </div>

      {/* Employees Surface */}
      <div className="rounded-2xl bg-white border border-[#E9EAEE] shadow-xs overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="sm:hidden divide-y divide-[#E9EAEE]">
          {filteredEmployees.map((emp) => (
            <div key={emp.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#20242C]">{emp.first_name} {emp.last_name}</h4>
                  <span className="font-mono text-[11px] text-[#D62839] font-bold">{emp.employee_code}</span>
                </div>
                <Badge status={emp.status} />
              </div>
              <p className="text-xs text-[#667085] flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#D62839]" />
                <span>{emp.designation} — <strong className="text-[#20242C]">{emp.department_name || 'General'}</strong></span>
              </p>
              <div className="flex justify-between items-center pt-2 text-xs border-t border-[#E9EAEE]">
                <span className="text-[#667085] font-mono">{emp.email}</span>
                <span className="font-mono font-bold text-[#20242C]">{formatCurrency(Number(emp.salary))}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-sm text-[#20242C]">
            <thead className="bg-[#F8FAFC] text-xs uppercase font-semibold text-[#667085] border-b border-[#E9EAEE]">
              <tr>
                <th className="px-6 py-4">Emp Code</th>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Designation</th>
                <th className="px-6 py-4 text-right">Compensation</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9EAEE]">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-[#FFF1F2]/30 transition-colors">
                  <td className="px-6 py-4 font-mono font-semibold text-[#D62839] text-xs">
                    {emp.employee_code}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-[#20242C]">{emp.first_name} {emp.last_name}</p>
                    <p className="text-xs text-[#667085] mt-0.5">{emp.email}</p>
                  </td>
                  <td className="px-6 py-4 text-[#20242C] font-medium">
                    {emp.department_name || 'General'}
                  </td>
                  <td className="px-6 py-4 text-[#667085] font-medium">
                    {emp.designation}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-semibold text-[#20242C]">
                    {formatCurrency(Number(emp.salary))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge status={emp.status} />
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-[#667085] text-sm">
                    {employees.length === 0 ? 'No employees registered in this workspace yet.' : 'No matching employees found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD EMPLOYEE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register New Employee"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085] mb-1.5">
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

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E9EAEE]">
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
