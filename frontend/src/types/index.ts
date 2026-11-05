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

export interface LeadActivity {
  id: number;
  lead_id: number;
  user_id?: number | null;
  user_name?: string;
  activity_type: 'call' | 'email' | 'meeting' | 'whatsapp' | 'note' | 'status_change' | 'import' | 'system';
  title: string;
  description?: string;
  activity_date: string;
  metadata?: any;
}

export interface LeadSourceConfig {
  id: number;
  tenant_id?: number;
  source_key: string;
  name: string;
  category: string;
  status: 'live_api_sync' | 'connected_syncing' | 'connected' | 'user_export_available' | 'email_integration_available' | 'manual_csv_import' | 'manual_import_only' | 'webhook_configured' | 'auth_required' | 'api_access_required' | 'blocked' | 'unsupported' | 'syncing' | 'launcher_only' | 'csv_import_available' | 'configuration_required';
  sync_mode?: 'api_pull' | 'webhook_push' | 'manual_import' | 'unsupported';
  api_key?: string;
  webhook_secret?: string;
  last_sync_at?: string;
  sync_checkpoint?: string;
  sync_interval_minutes?: number;
  last_error_message?: string;
  last_error_at?: string;
  retry_count?: number;
  auto_assign_user_id?: number | null;
  auto_assign_user_name?: string;
  is_enabled?: boolean | number;
  has_credentials?: boolean;
  masked_credentials?: Record<string, string>;
  sync_count: number;
  total_leads?: number;
  won_leads?: number;
  pending_followups?: number;
  total_leads_count?: number;
  converted_leads_count?: number;
}

export interface LeadSyncLog {
  id: number;
  tenant_id: number;
  source_key: string;
  source_name?: string;
  sync_type: 'cron' | 'manual' | 'webhook' | 'test';
  status: 'success' | 'failed' | 'partial';
  leads_fetched: number;
  leads_created: number;
  leads_updated: number;
  leads_skipped: number;
  checkpoint_before?: string;
  checkpoint_after?: string;
  error_details?: string;
  execution_time_ms: number;
  created_at: string;
}

export interface Lead {
  id: number;
  tenant_id?: number;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  value: number;
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';
  source?: string;
  source_platform?: string;
  service_requirement?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: number | null;
  assigned_user_name?: string;
  assigned_user_email?: string;
  source_lead_id?: string;
  sync_status?: 'synced' | 'manual' | 'webhook' | 'pending_retry' | 'error';
  last_contact_date?: string;
  next_followup_date?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  pending_followups_count?: number;
  activities_count?: number;
  next_scheduled_followup?: string;
  calculated_followup_status?: 'today' | 'overdue' | 'pending' | 'completed' | 'no_followup' | 'won' | 'lost';
  external_sync_status?: 'synced' | 'pending_writeback' | 'conflict' | 'failed' | 'manual_required' | 'not_applicable';
  last_external_sync_at?: string;
  external_snapshot_json?: any;
  follow_ups?: Followup[];
  activities?: LeadActivity[];
}

export interface PlatformCapability {
  platform_key: string;
  display_name: string;
  capabilities: {
    read_leads: string;
    update_status: string;
    add_notes: string;
    update_followup: string;
    update_contact: string;
    assign_lead: string;
    writeback_verified: string;
  };
}

export interface WritebackQueueItem {
  id: number;
  tenant_id: number;
  lead_id: number;
  source_platform: string;
  source_lead_id: string;
  action_type: string;
  proposed_payload: any;
  original_snapshot?: any;
  status: 'pending_confirmation' | 'queued' | 'in_progress' | 'synced' | 'conflict_detected' | 'failed' | 'manual_action_required';
  conflict_details?: any;
  error_message?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
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
  customer_phone?: string;
  customer_email?: string;
  lead_id?: number;
  lead_name?: string;
  lead_company?: string;
  lead_phone?: string;
  lead_email?: string;
  lead_source?: string;
  lead_service?: string;
  title: string;
  notes?: string;
  scheduled_at: string;
  contact_method?: 'call' | 'email' | 'meeting' | 'whatsapp' | 'other';
  assigned_to?: number;
  assigned_user_name?: string;
  outcome?: string;
  completed_at?: string;
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
  tenant_id?: number;
  name: string;
  category: 'productivity' | 'communication' | 'cloud' | 'business' | 'custom';
  icon_name: string;
  custom_icon_url?: string;
  app_url: string;
  connection_status: 'connected' | 'launcher_only' | 'config_required' | 'unsupported' | 'disconnected' | 'expired' | 'captcha_required' | 'auth_required' | 'mfa_required' | 'error' | 'api_access_required' | 'manual_import_only';
  auth_type: 'direct_link' | 'oauth' | 'api_key' | 'credentials' | 'session';
  is_pinned: number;
  settings_json?: Record<string, any>;
  source_key?: 'eaf' | 'bni' | 'kvv' | string | null;
  is_portal?: boolean;
  session_status?: 'active' | 'expired' | 'captcha_required' | 'mfa_required' | 'disconnected' | 'auth_required' | 'error';
  has_stored_credentials?: boolean;
  last_synced_at?: string | null;
  last_error?: string | null;
  sync_count?: number;
  auth_status?: 'connected' | 'auth_required' | 'api_access_required' | 'manual_import_only' | 'disconnected' | 'expired' | 'captcha_required' | 'launcher_only' | string;
  integration_capability?: string;
  sync_status?: 'sync_successful' | 'sync_failed' | 'sync_never_run' | 'api_access_required' | 'manual_import_only' | 'not_applicable' | string;
  last_sync_display?: string;
  next_action?: string;
  next_action_key?: string;
  connected_email?: string;
  redirect_uri?: string;
  sync_interval_minutes?: number | null;
  next_sync_at?: string | null;
  seconds_until_next?: number | null;
  records_synced?: number;
  is_syncing?: boolean;
  live_badge?: 'Connected' | 'Syncing' | 'Synced' | 'Sync Failed' | 'Reconnect Required' | 'Configuration Required' | 'Launcher Only' | string;
  latest_sync_log?: {
    leads_fetched: number;
    leads_created: number;
    leads_updated: number;
    leads_skipped: number;
    status: string;
    created_at: string;
  } | null;
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

export interface GmailAttachment {
  filename: string;
  mime_type: string;
  size: number;
  attachment_id: string;
}

export interface GmailMessage {
  id: number;
  message_id: string;
  thread_id: string;
  from_name?: string;
  from_email?: string;
  to_recipients?: string;
  cc_recipients?: string;
  bcc_recipients?: string;
  subject: string;
  snippet: string;
  body_plain?: string;
  body_html?: string;
  date_sent: string;
  is_read: boolean;
  is_starred: boolean;
  is_draft: boolean;
  is_sent: boolean;
  is_trash: boolean;
  is_spam: boolean;
  is_important: boolean;
  has_attachments: boolean;
  attachments?: GmailAttachment[];
  labels?: string[];
}

export interface GmailStatus {
  is_connected: boolean;
  connection_status: 'connected' | 'disconnected' | 'expired' | 'auth_required';
  is_configured: boolean;
  email_address?: string | null;
  account_name?: string | null;
  last_sync_at?: string | null;
  sync_status?: string;
  unread_count: number;
  messages_count: number;
  last_error?: string | null;
  redirect_uri?: string;
}

export type GmailFolderType = 'inbox' | 'starred' | 'sent' | 'drafts' | 'important' | 'spam' | 'trash' | 'all';
