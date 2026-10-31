import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  CreditCard, 
  Eye, 
  Printer, 
  Trash2
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import type { Invoice, Customer, InvoiceItem, Payment } from '../types';

export const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // New Invoice Form State
  const [customerId, setCustomerId] = useState<number>(0);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
  const [items, setItems] = useState<{ description: string; quantity: number; unit_price: number }[]>([
    { description: 'Enterprise Architecture & Advisory', quantity: 1, unit_price: 150000 }
  ]);
  const [taxRate, setTaxRate] = useState<number>(18.0);
  const [notes, setNotes] = useState('');

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'bank_transfer' | 'cash' | 'card' | 'cheque'>('upi');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchInvoices = async () => {
    try {
      const data: any = await api.get('/invoices');
      setInvoices(data || []);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const data: any = await api.get('/crm/customers');
      setCustomers(data || []);
      if (data && data.length > 0 && !customerId) {
        setCustomerId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
  }, []);

  const openInvoiceDetails = async (id: number) => {
    try {
      const inv: any = await api.get(`/invoices/${id}`);
      setSelectedInvoice(inv);
      setIsViewOpen(true);
    } catch (err) {
      console.error('Failed to fetch invoice details', err);
    }
  };

  const openPaymentModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setPaymentAmount(inv.outstanding_amount);
    setPaymentRef(`PAY-${Date.now().toString().slice(-6)}`);
    setIsPaymentOpen(true);
  };

  // Line item handlers
  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, val: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = val;
    setItems(updated);
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const grandTotal = subtotal + taxAmount;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;

    try {
      await api.post('/invoices', {
        customer_id: customerId,
        invoice_date: invoiceDate,
        due_date: dueDate,
        tax_rate: taxRate,
        items,
        notes
      });
      setIsCreateOpen(false);
      fetchInvoices();
    } catch (err: any) {
      alert(err.message || 'Error creating invoice');
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setSubmittingPayment(true);
    try {
      await api.post(`/invoices/${selectedInvoice.id}/payments`, {
        amount: paymentAmount,
        payment_method: paymentMethod,
        transaction_reference: paymentRef,
        notes: paymentNotes
      });
      setIsPaymentOpen(false);
      fetchInvoices();
    } catch (err: any) {
      alert(err.message || 'Error recording payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  const filtered = invoices.filter(inv => 
    (inv.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (inv.customer_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice # or client name..."
            className="cockpit-input pl-10"
          />
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="cockpit-btn-primary"
        >
          <Plus className="w-4 h-4" />
          <span>Generate Tax Invoice</span>
        </button>
      </div>

      {/* Invoices Surface */}
      <div className="rounded-2xl bg-white border border-[#E9EAEE] overflow-hidden shadow-xs">
        {/* Mobile View: Cards */}
        <div className="sm:hidden divide-y divide-[#E9EAEE]">
          {filtered.map((inv) => (
            <div key={inv.id} className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-[#D62839]">{inv.invoice_number}</span>
                <Badge status={inv.status} />
              </div>
              <div>
                <p className="font-bold text-[#20242C] text-sm">{inv.customer_name}</p>
                <p className="text-xs text-[#667085]">{inv.customer_company}</p>
              </div>
              <div className="flex justify-between items-baseline pt-1 text-xs">
                <span className="text-[#667085]">Total: <strong className="font-mono text-[#20242C]">{formatCurrency(Number(inv.total_amount))}</strong></span>
                <span className="text-[#D97706] font-bold font-mono">Bal: {formatCurrency(Number(inv.outstanding_amount))}</span>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E9EAEE]">
                <button
                  onClick={() => openInvoiceDetails(inv.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#F8F9FB] hover:bg-[#FFF1F2] text-[#667085] hover:text-[#D62839] border border-[#E9EAEE] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View</span>
                </button>
                {Number(inv.outstanding_amount) > 0 && (
                  <button
                    onClick={() => openPaymentModal(inv)}
                    className="px-3 py-1.5 rounded-lg bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#D62839] border border-[#FECDD3] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Record Pay</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Responsive Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-sm text-[#20242C]">
            <thead className="bg-[#F8F9FB] text-xs uppercase font-bold text-[#667085] border-b border-[#E9EAEE]">
              <tr>
                <th className="px-6 py-4">Invoice #</th>
                <th className="px-6 py-4">Client Organization</th>
                <th className="px-6 py-4">Date / Due</th>
                <th className="px-6 py-4 text-right">Total Amount</th>
                <th className="px-6 py-4 text-right">Paid Amount</th>
                <th className="px-6 py-4 text-right">Outstanding</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9EAEE]">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-[#FFF1F2]/30 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-[#D62839]">
                    {inv.invoice_number}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-[#20242C]">{inv.customer_name}</p>
                    <p className="text-xs text-[#667085]">{inv.customer_company}</p>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono">
                    <p className="text-[#20242C] font-medium">{inv.invoice_date}</p>
                    <p className="text-[#667085]">Due: {inv.due_date}</p>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-[#20242C] font-mono">
                    {formatCurrency(Number(inv.total_amount))}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-[#059669] font-mono">
                    {formatCurrency(Number(inv.paid_amount))}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-[#D97706] font-mono">
                    {formatCurrency(Number(inv.outstanding_amount))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge status={inv.status} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openInvoiceDetails(inv.id)}
                        className="p-1.5 rounded-lg bg-[#F8F9FB] hover:bg-[#FFF1F2] text-[#667085] hover:text-[#D62839] border border-[#E9EAEE] transition-colors cursor-pointer"
                        title="View / Print Tax Invoice"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {Number(inv.outstanding_amount) > 0 && (
                        <button
                          onClick={() => openPaymentModal(inv)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#D62839] border border-[#FECDD3] text-xs font-semibold transition-colors cursor-pointer"
                          title="Record Payment"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Pay</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[#94A3B8] text-sm">
                    No invoices found. Click "Generate Tax Invoice" above to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE INVOICE MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Commercial Tax Invoice"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                Select Customer
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(Number(e.target.value))}
                className="cockpit-input"
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.company || 'Direct'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                Invoice Date
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="cockpit-input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="cockpit-input font-mono"
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085]">
                Invoice Line Items
              </label>
              <button
                type="button"
                onClick={addItem}
                className="text-xs text-[#D62839] hover:text-[#B91C2C] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-[#F8F9FB] p-3 rounded-xl border border-[#E9EAEE]">
                  <input
                    type="text"
                    required
                    placeholder="Item description / service"
                    value={it.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    className="flex-1 cockpit-input text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={it.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                      className="w-20 cockpit-input text-xs"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Unit Price"
                      value={it.unit_price}
                      onChange={(e) => updateItem(idx, 'unit_price', Number(e.target.value))}
                      className="w-28 cockpit-input text-xs font-mono"
                    />
                    <span className="w-28 text-right font-mono text-sm text-[#20242C] font-bold">
                      {formatCurrency(it.quantity * it.unit_price)}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1.5 text-[#94A3B8] hover:text-[#DC2626] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tax & Summary */}
          <div className="flex flex-col sm:flex-row items-end justify-between pt-4 border-t border-[#E9EAEE] gap-4">
            <div className="w-full sm:w-1/2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                GST Tax Rate (%)
              </label>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-32 cockpit-input font-mono"
              />
            </div>
            <div className="w-full sm:w-1/2 space-y-1.5 text-sm font-mono text-right">
              <div className="flex justify-between text-[#667085]">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#667085]">
                <span>GST Tax ({taxRate}%):</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-[#20242C] pt-2 border-t border-[#E9EAEE]">
                <span>Grand Total:</span>
                <span className="text-[#D62839]">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E9EAEE]">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="cockpit-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cockpit-btn-primary"
            >
              Generate Invoice
            </button>
          </div>
        </form>
      </Modal>

      {/* RECORD PAYMENT MODAL */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        title={`Record Payment for ${selectedInvoice?.invoice_number}`}
      >
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          <div className="p-4 rounded-xl bg-[#F8F9FB] border border-[#E9EAEE] space-y-1">
            <div className="flex justify-between text-xs text-[#667085]">
              <span>Total Invoice Amount:</span>
              <span className="font-mono text-[#20242C] font-bold">{formatCurrency(selectedInvoice?.total_amount || 0)}</span>
            </div>
            <div className="flex justify-between text-xs text-[#667085]">
              <span>Already Collected:</span>
              <span className="font-mono text-[#059669] font-bold">{formatCurrency(selectedInvoice?.paid_amount || 0)}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold pt-2 border-t border-[#E9EAEE] text-[#D62839]">
              <span>Current Outstanding:</span>
              <span className="font-mono">{formatCurrency(selectedInvoice?.outstanding_amount || 0)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1.5">
              Payment Amount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              max={selectedInvoice?.outstanding_amount}
              required
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
              className="cockpit-input font-mono font-bold text-base"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="cockpit-input"
              >
                <option value="upi">UPI / QR Code</option>
                <option value="bank_transfer">Direct Bank Transfer / NEFT</option>
                <option value="card">Credit / Debit Card</option>
                <option value="cash">Cash Collection</option>
                <option value="cheque">Bank Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085] mb-1.5">
                Reference ID
              </label>
              <input
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="cockpit-input font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E9EAEE]">
            <button
              type="button"
              onClick={() => setIsPaymentOpen(false)}
              className="cockpit-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingPayment || paymentAmount <= 0}
              className="cockpit-btn-primary"
            >
              {submittingPayment ? 'Processing...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* VIEW & PRINT INVOICE MODAL */}
      <Modal
        isOpen={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        title="Commercial Tax Invoice Preview"
        maxWidth="max-w-4xl"
      >
        {selectedInvoice && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 bg-white border border-[#E9EAEE] text-[#20242C] rounded-2xl shadow-sm font-sans" id="printable-invoice">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start pb-6 border-b border-[#E9EAEE] gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-[#D62839] tracking-tight">
                    {selectedInvoice.tenant_name || 'MY COCKPIT ENTERPRISE'}
                  </h2>
                  <p className="text-xs text-[#667085] mt-1 font-medium">Official Commercial Tax Invoice & Receipt</p>
                </div>
                <div className="sm:text-right">
                  <h3 className="text-xl font-bold font-mono text-[#20242C]">{selectedInvoice.invoice_number}</h3>
                  <p className="text-xs text-[#667085]">Date: {selectedInvoice.invoice_date}</p>
                  <p className="text-xs text-[#667085]">Due: {selectedInvoice.due_date}</p>
                </div>
              </div>

              {/* Billed To */}
              <div className="py-6 border-b border-[#E9EAEE] grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div>
                  <span className="text-xs font-bold text-[#667085] uppercase tracking-wider block mb-1">Billed To:</span>
                  <p className="font-bold text-[#20242C] text-base">{selectedInvoice.customer_name}</p>
                  <p className="text-[#667085]">{selectedInvoice.customer_company}</p>
                  <p className="text-[#667085] text-xs">{selectedInvoice.customer_email}</p>
                  {selectedInvoice.customer_tax_id && (
                    <p className="text-xs font-mono text-[#667085] mt-1 font-semibold">GSTIN: {selectedInvoice.customer_tax_id}</p>
                  )}
                </div>
                <div className="sm:text-right">
                  <span className="text-xs font-bold text-[#667085] uppercase tracking-wider block mb-1">Invoice Status:</span>
                  <Badge status={selectedInvoice.status} />
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto my-6">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E9EAEE] text-xs text-[#667085] uppercase font-bold bg-[#F8F9FB]">
                      <th className="py-3 px-3">Description</th>
                      <th className="py-3 px-3 text-center">Qty</th>
                      <th className="py-3 px-3 text-right">Rate</th>
                      <th className="py-3 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E9EAEE]">
                    {selectedInvoice.items?.map((it: InvoiceItem, idx: number) => (
                      <tr key={idx}>
                        <td className="py-3 px-3 font-semibold text-[#20242C]">{it.description}</td>
                        <td className="py-3 px-3 text-center text-[#667085]">{it.quantity}</td>
                        <td className="py-3 px-3 text-right font-mono text-[#667085]">{formatCurrency(it.unit_price)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[#20242C]">{formatCurrency(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="border-t border-[#E9EAEE] pt-4 flex justify-end">
                <div className="w-64 space-y-1.5 text-sm font-mono text-right">
                  <div className="flex justify-between text-[#667085]">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[#667085]">
                    <span>GST ({selectedInvoice.tax_rate}%):</span>
                    <span>{formatCurrency(selectedInvoice.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-[#20242C] text-base pt-2 border-t border-[#E9EAEE]">
                    <span>Total Amount:</span>
                    <span>{formatCurrency(selectedInvoice.total_amount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[#059669]">
                    <span>Paid to Date:</span>
                    <span>{formatCurrency(selectedInvoice.paid_amount)}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-[#D62839] text-base pt-1 border-t border-[#E9EAEE]">
                    <span>Balance Due:</span>
                    <span>{formatCurrency(selectedInvoice.outstanding_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Payment History Log */}
              {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                <div className="mt-8 pt-4 border-t border-[#E9EAEE] text-xs">
                  <span className="font-bold text-[#20242C] uppercase tracking-wider block mb-2">Recorded Cleared Payments:</span>
                  <div className="space-y-1">
                    {selectedInvoice.payments.map((p: Payment, idx: number) => (
                      <div key={idx} className="flex justify-between text-[#667085] font-mono py-1 px-2 rounded bg-[#F8F9FB]">
                        <span>{p.payment_date} — {p.payment_method?.toUpperCase()} ({p.transaction_reference || 'Ref cleared'})</span>
                        <span className="font-bold text-[#059669]">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => window.print()}
                className="cockpit-btn-primary"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official Tax Invoice</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
