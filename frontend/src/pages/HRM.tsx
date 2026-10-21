import React, { useState, useEffect } from 'react';
import { Plus, Users, Briefcase, Mail, Phone, DollarSign, Building, Search } from 'lucide-react';
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
      setEmployees(empRes);
      setDepartments(deptRes);
      if (deptRes.length > 0 && !departmentId) {
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
          <h2 className="text-2xl font-bold text-[#172033] tracking-tight">Team & Personnel Directory</h2>
          <p className="text-sm text-[#64748B] mt-0.5">
            Manage your team roster, departmental distributions, and compensation structures
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="cockpit-btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#4667E8] text-white text-sm font-semibold shadow-sm hover:bg-[#3b5bd6] transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Team Member</span>
        </button>
      </div>

      {/* Departments Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {departments.map((d) => (
          <div key={d.id} className="p-5 rounded-2xl bg-white border border-[#E5EAF1] shadow-sm hover:border-[#4667E8]/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">{d.name}</span>
              <span className="px-2.5 py-1 rounded-full bg-[#EEF2FF] text-[#4667E8] text-xs font-semibold font-mono">
                {d.employee_count || 0} Staff
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-2 line-clamp-1">{d.description || 'Core Organizational Division'}</p>
          </div>
        ))}
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E5EAF1] shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search team member by name, role, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] placeholder-[#94A3B8] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
          />
        </div>
        <div className="text-xs font-medium text-[#64748B]">
          Showing {filteredEmployees.length} of {employees.length} team members
        </div>
      </div>

      {/* Employees Table */}
      <div className="rounded-2xl bg-white border border-[#E5EAF1] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#172033]">
            <thead className="bg-[#F8FAFC] text-xs uppercase font-semibold text-[#64748B] border-b border-[#E5EAF1]">
              <tr>
                <th className="px-6 py-4">Emp Code</th>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Designation</th>
                <th className="px-6 py-4 text-right">Compensation</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF1]">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-6 py-4 font-mono font-semibold text-[#4667E8] text-xs">
                    {emp.employee_code}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-[#172033]">{emp.first_name} {emp.last_name}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">{emp.email}</p>
                  </td>
                  <td className="px-6 py-4 text-[#172033] font-medium">
                    {emp.department_name || 'General'}
                  </td>
                  <td className="px-6 py-4 text-[#64748B] font-medium">
                    {emp.designation}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-semibold text-[#172033]">
                    {formatCurrency(Number(emp.salary))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge status={emp.status} />
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-[#64748B] text-sm">
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
                First Name
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Aarav"
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Sharma"
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Work Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aarav@company.com"
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Phone Number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
                Department
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
                Designation
              </label>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Senior Engineer"
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
              Monthly Compensation (₹)
            </label>
            <input
              type="number"
              min="0"
              value={salary}
              onChange={(e) => setSalary(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E5EAF1] rounded-xl text-sm font-mono text-[#172033] focus:outline-none focus:border-[#4667E8] focus:bg-white transition-all"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E5EAF1]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:text-[#172033] text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary px-5 py-2 rounded-xl bg-[#4667E8] text-white text-sm font-semibold shadow-sm hover:bg-[#3b5bd6] transition-all"
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
