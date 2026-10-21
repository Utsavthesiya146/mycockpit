-- ===================================================
-- MY COCKPIT AI - Development Seed Data
-- Provides Demo Accounts:
-- 1. Super Admin: admin@mycockpit.ai (AdminPassword123!)
-- 2. Client A: utsav@acme.com (Password123!) [Tenant: utsav]
-- 3. Client B: rahul@nexus.com (Password123!) [Tenant: rahul]
-- ===================================================

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE `ai_messages`;
TRUNCATE TABLE `ai_conversations`;
TRUNCATE TABLE `connected_apps`;
TRUNCATE TABLE `payments`;
TRUNCATE TABLE `invoice_items`;
TRUNCATE TABLE `invoices`;
TRUNCATE TABLE `follow_ups`;
TRUNCATE TABLE `tasks`;
TRUNCATE TABLE `calendar_events`;
TRUNCATE TABLE `hrm_employees`;
TRUNCATE TABLE `hrm_departments`;
TRUNCATE TABLE `crm_leads`;
TRUNCATE TABLE `crm_contacts`;
TRUNCATE TABLE `crm_customers`;
TRUNCATE TABLE `users`;
TRUNCATE TABLE `tenants`;

-- 1. Tenants
INSERT INTO `tenants` (`id`, `slug`, `name`, `domain`, `status`, `plan`, `created_at`) VALUES
(1, 'utsav', 'Acme Innovations Pvt Ltd', 'acme.akiradigital.com', 'active', 'enterprise', NOW()),
(2, 'rahul', 'Nexus Digital Works', 'nexus.akiradigital.com', 'active', 'pro', NOW()),
(3, 'akira', 'Akira Digital Systems', 'akiradigital.com', 'active', 'enterprise', NOW());

-- 2. Users
-- Passwords:
-- Admin: AdminPassword123! -> $2y$10$a2O3RuMwPASttfu/l9CMCuWuc/Y3autOmHZGx.19iDnr3tiIK4aUe
-- Client: Password123! -> $2y$10$XZjP6BrzzlWM.We1pdWxc.Eat7k5Sf8StzOC0JHYb6ARewolIKYSy
INSERT INTO `users` (`id`, `tenant_id`, `name`, `email`, `password_hash`, `role`, `status`, `phone`, `created_at`) VALUES
-- Super Admin (tenant_id is NULL)
(1, NULL, 'System Super Admin', 'admin@mycockpit.ai', '$2y$10$a2O3RuMwPASttfu/l9CMCuWuc/Y3autOmHZGx.19iDnr3tiIK4aUe', 'super_admin', 'active', '+91 9876543210', NOW()),
-- Client A (utsav)
(2, 1, 'Utsav Patel', 'utsav@acme.com', '$2y$10$XZjP6BrzzlWM.We1pdWxc.Eat7k5Sf8StzOC0JHYb6ARewolIKYSy', 'tenant_owner', 'active', '+91 9820011223', NOW()),
(3, 1, 'Aarav Sharma', 'aarav@acme.com', '$2y$10$XZjP6BrzzlWM.We1pdWxc.Eat7k5Sf8StzOC0JHYb6ARewolIKYSy', 'employee', 'active', '+91 9820044556', NOW()),
-- Client B (rahul)
(4, 2, 'Rahul Verma', 'rahul@nexus.com', '$2y$10$XZjP6BrzzlWM.We1pdWxc.Eat7k5Sf8StzOC0JHYb6ARewolIKYSy', 'tenant_owner', 'active', '+91 9930055667', NOW()),
(5, 2, 'Sneha Joshi', 'sneha@nexus.com', '$2y$10$XZjP6BrzzlWM.We1pdWxc.Eat7k5Sf8StzOC0JHYb6ARewolIKYSy', 'employee', 'active', '+91 9930077889', NOW());

-- 3. CRM Customers (Client A)
INSERT INTO `crm_customers` (`id`, `tenant_id`, `name`, `company`, `email`, `phone`, `city`, `tax_id`, `status`) VALUES
(1, 1, 'TechCorp Global Ltd', 'TechCorp Solutions', 'contact@techcorp.com', '+91 9123456780', 'Bengaluru', '29AABCT1234A1Z5', 'active'),
(2, 1, 'Vertex Media Group', 'Vertex Media', 'accounts@vertexmedia.com', '+91 9234567891', 'Mumbai', '27AABCV5678B1Z2', 'active'),
-- CRM Customers (Client B - strictly isolated)
(3, 2, 'BlueSky Logistics', 'BlueSky Freight Inc', 'info@blueskydelivery.com', '+91 9345678902', 'Delhi', '07AABCB9012C1Z8', 'active');

-- 4. CRM Contacts
INSERT INTO `crm_contacts` (`id`, `tenant_id`, `customer_id`, `name`, `email`, `phone`, `designation`) VALUES
(1, 1, 1, 'Ramesh Gupta', 'ramesh@techcorp.com', '+91 9123456781', 'Chief Technology Officer'),
(2, 1, 2, 'Priya Nair', 'priya@vertexmedia.com', '+91 9234567892', 'Marketing Director'),
(3, 2, 3, 'Amit Mehra', 'amit@blueskydelivery.com', '+91 9345678903', 'Operations Head');

-- 5. CRM Leads
INSERT INTO `crm_leads` (`id`, `tenant_id`, `name`, `company`, `email`, `phone`, `value`, `status`, `source`) VALUES
(1, 1, 'Infosys Cloud Expansion', 'Infosys Ltd', 'procurement@infosys.demo', '+91 9456789012', 450000.00, 'qualified', 'Inbound Referral'),
(2, 1, 'Wipro Enterprise AI Suite', 'Wipro Digital', 'ai-team@wipro.demo', '+91 9567890123', 850000.00, 'proposal', 'BNI Connect'),
(3, 2, 'Apollo Hospital ERP Integration', 'Apollo Healthcare', 'healthit@apollo.demo', '+91 9678901234', 600000.00, 'contacted', 'Direct Outreach');

-- 6. HRM Departments
INSERT INTO `hrm_departments` (`id`, `tenant_id`, `name`, `description`) VALUES
(1, 1, 'Engineering', 'Product engineering and AI development team'),
(2, 1, 'Sales & Marketing', 'Enterprise sales, partnerships and client success'),
(3, 2, 'Logistics Ops', 'Fleet and warehouse management operations');

-- 7. HRM Employees
INSERT INTO `hrm_employees` (`id`, `tenant_id`, `user_id`, `employee_code`, `first_name`, `last_name`, `email`, `phone`, `department_id`, `designation`, `joining_date`, `salary`, `status`) VALUES
(1, 1, 3, 'EMP-101', 'Aarav', 'Sharma', 'aarav@acme.com', '+91 9820044556', 1, 'Senior AI Engineer', '2024-01-15', 125000.00, 'active'),
(2, 1, NULL, 'EMP-102', 'Pooja', 'Patel', 'pooja@acme.com', '+91 9820066778', 2, 'Growth Lead', '2024-03-01', 95000.00, 'active'),
(3, 2, 5, 'EMP-201', 'Sneha', 'Joshi', 'sneha@nexus.com', '+91 9930077889', 3, 'Operations Manager', '2024-02-10', 85000.00, 'active');

-- 8. Calendar Events
INSERT INTO `calendar_events` (`id`, `tenant_id`, `title`, `description`, `event_type`, `start_time`, `end_time`, `location_or_url`, `status`, `created_by`) VALUES
(1, 1, 'Q4 Strategy Review with TechCorp', 'Quarterly roadmap and deliverables sign-off', 'meeting', DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 2 HOUR), DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 3 HOUR), 'https://meet.google.com/abc-demo-xyz', 'scheduled', 2),
(2, 1, 'Product Architecture Alignment', 'Internal team sync on AI agent features', 'appointment', DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 DAY), DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 25 HOUR), 'Office Boardroom A', 'scheduled', 2),
(3, 2, 'Fleet Dispatch Audit Sync', 'Weekly logistics review meeting', 'meeting', DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 4 HOUR), DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 HOUR), 'https://meet.google.com/nexus-audit', 'scheduled', 4);

-- 9. Tasks
INSERT INTO `tasks` (`id`, `tenant_id`, `title`, `description`, `assigned_to`, `priority`, `status`, `due_date`, `created_by`) VALUES
(1, 1, 'Finalize Hostinger Deployment Pipeline', 'Configure static build export and automated database migrations', 3, 'urgent', 'in_progress', DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY), 2),
(2, 1, 'Follow-up on Vertex Media Contract Renewal', 'Send amended terms of service and scope agreement', 2, 'high', 'pending', DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY), 2),
(3, 1, 'Prepare Monthly GST Tax Reconciliation', 'Match input tax credits with purchase invoices', 2, 'medium', 'pending', DATE_ADD(CURRENT_DATE, INTERVAL 5 DAY), 2),
(4, 2, 'Audit Warehouse Security Checkpoints', 'Inspect CCTV and biometric logs for central hub', 5, 'high', 'pending', DATE_ADD(CURRENT_DATE, INTERVAL 3 DAY), 4);

-- 10. Follow-ups
INSERT INTO `follow_ups` (`id`, `tenant_id`, `customer_id`, `lead_id`, `title`, `notes`, `scheduled_at`, `status`, `reminder_time`, `created_by`) VALUES
(1, 1, 1, NULL, 'TechCorp Quarterly Invoice Payment Check', 'Confirm wire transfer status for INV-UTS-001 balance', DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 DAY), 'pending', DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 22 HOUR), 2),
(2, 1, 2, NULL, 'Vertex Media Demo Signoff', 'Deliver proof of concept presentation on marketing dashboard', CURRENT_TIMESTAMP, 'completed', NULL, 2),
(3, 2, 3, NULL, 'BlueSky Delivery Milestone 2 Followup', 'Check client satisfaction on newly deployed dispatch routes', DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 2 DAY), 'pending', DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 46 HOUR), 4);

-- 11. Invoices & Items (Financials matching the prompt scenario)
-- Client A:
-- INV-UTS-001: Subtotal 500000, Tax 90000 (18%), Total 590000, Paid 300000, Outstanding 290000 (partially_paid)
-- INV-UTS-002: Subtotal 350000, Tax 63000 (18%), Total 413000, Paid 350000, Outstanding 63000 (partially_paid)
-- Combined Client A: Total Receivable = 10,03,000, Total Received = 6,50,000, Pending = 3,53,000
INSERT INTO `invoices` (`id`, `tenant_id`, `customer_id`, `invoice_number`, `invoice_date`, `due_date`, `subtotal`, `discount_type`, `discount_value`, `discount_amount`, `tax_rate`, `tax_amount`, `total_amount`, `paid_amount`, `outstanding_amount`, `status`, `notes`) VALUES
(1, 1, 1, 'INV-UTS-001', DATE_SUB(CURRENT_DATE, INTERVAL 20 DAY), DATE_ADD(CURRENT_DATE, INTERVAL 10 DAY), 500000.00, 'fixed', 0.00, 0.00, 18.00, 90000.00, 590000.00, 300000.00, 290000.00, 'partially_paid', 'Enterprise SaaS Customization & Implementation Services'),
(2, 1, 2, 'INV-UTS-002', DATE_SUB(CURRENT_DATE, INTERVAL 10 DAY), DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY), 350000.00, 'fixed', 0.00, 0.00, 18.00, 63000.00, 413000.00, 350000.00, 63000.00, 'overdue', 'Brand Marketing Analytics & Performance Dashboard'),
-- Client B (Isolated):
-- INV-NX-101: Subtotal 200000, Tax 36000 (18%), Total 236000, Paid 100000, Outstanding 136000
(3, 2, 3, 'INV-NX-101', DATE_SUB(CURRENT_DATE, INTERVAL 15 DAY), DATE_ADD(CURRENT_DATE, INTERVAL 15 DAY), 200000.00, 'fixed', 0.00, 0.00, 18.00, 36000.00, 236000.00, 100000.00, 136000.00, 'partially_paid', 'Logistics Route Optimization Module');

-- 12. Invoice Items
INSERT INTO `invoice_items` (`id`, `invoice_id`, `description`, `quantity`, `unit_price`, `tax_rate`, `total`) VALUES
(1, 1, 'Full Stack Cloud Architecture Deployment', 1.00, 300000.00, 18.00, 354000.00),
(2, 1, 'Custom LLM AI Knowledge Base Integration', 1.00, 200000.00, 18.00, 236000.00),
(3, 2, 'Marketing Performance Dashboard License', 1.00, 350000.00, 18.00, 413000.00),
(4, 3, 'Real-time GPS Tracking Engine Setup', 1.00, 200000.00, 18.00, 236000.00);

-- 13. Payments
INSERT INTO `payments` (`id`, `tenant_id`, `invoice_id`, `amount`, `payment_date`, `payment_method`, `transaction_reference`, `notes`, `created_by`) VALUES
(1, 1, 1, 300000.00, DATE_SUB(CURRENT_DATE, INTERVAL 15 DAY), 'bank_transfer', 'NEFT-HDFC-99881122', 'Initial 50% milestone payment', 2),
(2, 1, 2, 350000.00, DATE_SUB(CURRENT_DATE, INTERVAL 5 DAY), 'upi', 'UPI-ICICI-33445566', 'Advance payment for analytics suite', 2),
(3, 2, 3, 100000.00, DATE_SUB(CURRENT_DATE, INTERVAL 8 DAY), 'bank_transfer', 'IMPS-AXIS-77889900', 'Phase 1 development advance', 4);

-- 14. Connected Applications Hub (Pre-configured shortcuts & platforms)
INSERT INTO `connected_apps` (`id`, `tenant_id`, `name`, `category`, `icon_name`, `app_url`, `connection_status`, `auth_type`, `is_pinned`) VALUES
(1, 1, 'Google Calendar', 'productivity', 'Calendar', 'https://calendar.google.com', 'launcher_only', 'direct_link', 1),
(2, 1, 'Gmail Workspace', 'communication', 'Mail', 'https://mail.google.com', 'launcher_only', 'direct_link', 1),
(3, 1, 'Google Drive', 'cloud', 'HardDrive', 'https://drive.google.com', 'launcher_only', 'direct_link', 1),
(4, 1, 'BNI Connect', 'business', 'Users', 'https://www.bniconnectglobal.com', 'launcher_only', 'direct_link', 1),
(5, 1, 'KVV Portal', 'business', 'Briefcase', 'https://kvv.gov.in', 'launcher_only', 'direct_link', 1),
(6, 1, 'Right Form', 'productivity', 'FileText', 'https://rightform.com', 'launcher_only', 'direct_link', 0),
(7, 1, 'My iNotes', 'productivity', 'BookOpen', 'https://myinotes.com', 'launcher_only', 'direct_link', 0),
-- Client B Apps
(8, 2, 'Google Drive Business', 'cloud', 'HardDrive', 'https://drive.google.com', 'launcher_only', 'direct_link', 1),
(9, 2, 'Custom Logistics Hub', 'business', 'Truck', 'https://nexuslogistics.demo', 'launcher_only', 'direct_link', 1);

-- 15. AI Conversations & Messages (Pre-seeded client context)
INSERT INTO `ai_conversations` (`id`, `tenant_id`, `user_id`, `title`) VALUES
(1, 1, 2, 'Financial & Activity Briefing');

INSERT INTO `ai_messages` (`id`, `conversation_id`, `role`, `content`, `tokens_used`) VALUES
(1, 1, 'user', 'What is my pending payment amount and which customers need follow-up?', 25),
(2, 1, 'assistant', 'Here is your real-time financial and CRM summary for **Acme Innovations**:\n\n• **Financial Status**:\n  - Total Receivable: ₹10,03,000\n  - Total Received: ₹6,50,000\n  - **Total Pending**: ₹3,53,000\n  - Overdue Invoice: `INV-UTS-002` (Vertex Media Group) has an overdue balance of ₹63,000.\n\n• **Customer Follow-ups Needed**:\n  - **TechCorp Global**: Check wire transfer confirmation for `INV-UTS-001` outstanding balance of ₹2,90,000.\n  - **Wipro Enterprise Lead**: Proposal pending review (Value: ₹8,50,000).', 180);

SET FOREIGN_KEY_CHECKS = 1;
