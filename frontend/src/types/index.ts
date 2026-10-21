export type UserRole = 'super_admin' | 'tenant_owner' | 'tenant_admin' | 'employee' | 'read_only';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  tenant_id: number | null;
  tenant_slug?: string;
  tenant_name?: string;
  phone?: string;
}

export interface Tenant {
  id: number;
  slug: string;
  name: string;
  domain?: string;
  status: 'active' | 'inactive' | 'suspended';
  plan: string;
  user_count?: number;
  customer_count?: number;
  total_invoiced?: number;
  total_collected?: number;
  created_at: string;
}

export interface FinancialSummary {
  total_receivable: number;
  total_received: number;
  pending_amount: number;
  overdue_amount: number;
  total_invoices_count: number;
  paid_invoices_count: number;
  partially_paid_count: number;
  overdue_invoices_count: number;
  recent_payments: Payment[];
  monthly_revenue: { month_label: string; monthly_total: number }[];
}

export interface Customer {
  id: number;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  tax_id?: string;
  status: 'active' | 'inactive';
  contacts_count?: number;
  total_invoiced?: number;
  outstanding_balance?: number;
}

export interface Lead {
  id: number;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  value: number;
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';
  source?: string;
  notes?: string;
  created_at: string;
}

export interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  department_id?: number;
  department_name?: string;
  designation: string;
  joining_date: string;
  salary: number;
  status: 'active' | 'on_leave' | 'terminated';
}

export interface Department {
  id: number;
  name: string;
  description?: string;
  employee_count?: number;
}

export interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  event_type: 'meeting' | 'appointment' | 'event' | 'reminder';
  start_time: string;
  end_time: string;
  location_or_url?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  assigned_to?: number;
  assigned_user_name?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date?: string;
}

export interface Followup {
  id: number;
  customer_id?: number;
  customer_name?: string;
  lead_id?: number;
  lead_name?: string;
  title: string;
  notes?: string;
  scheduled_at: string;
  status: 'pending' | 'completed' | 'overdue';
  calculated_status?: string;
}

export interface InvoiceItem {
  id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string;
  customer_company?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_tax_id?: string;
  tenant_name?: string;
  tenant_slug?: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  discount_type: 'fixed' | 'percentage';
  discount_value: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  currency: string;
  notes?: string;
  items?: InvoiceItem[];
  payments?: Payment[];
  items_count?: number;
  payments_count?: number;
}

export interface Payment {
  id: number;
  invoice_id: number;
  amount: number;
  payment_date: string;
  payment_method: 'cash' | 'bank_transfer' | 'upi' | 'card' | 'cheque';
  transaction_reference?: string;
  notes?: string;
  invoice_number?: string;
  customer_name?: string;
}

export interface ConnectedApp {
  id: number;
  name: string;
  category: 'productivity' | 'communication' | 'cloud' | 'business' | 'custom';
  icon_name: string;
  custom_icon_url?: string;
  app_url: string;
  connection_status: 'connected' | 'launcher_only' | 'config_required' | 'unsupported';
  auth_type: 'direct_link' | 'oauth' | 'api_key';
  is_pinned: number;
  settings_json?: Record<string, any>;
}

export interface AIMessage {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: string[];
  tokens_used?: number;
  created_at?: string;
}

export interface AIConversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}
