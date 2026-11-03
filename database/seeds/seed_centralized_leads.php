<?php
declare(strict_types=1);

require_once __DIR__ . '/../../backend/config/Database.php';

use Cockpit\Config\Database;

try {
    $db = Database::getConnection();
    echo "Seeding Centralized Leads and Follow-ups for Tenant 1 & Tenant 2...\n";

    // Clean only existing demo leads & followups that we want to replace or enhance
    // Keep existing foreign keys safe
    $db->exec("DELETE FROM lead_activities WHERE tenant_id IN (1, 2)");
    $db->exec("DELETE FROM follow_ups WHERE tenant_id IN (1, 2) AND lead_id IS NOT NULL");
    $db->exec("DELETE FROM crm_leads WHERE tenant_id IN (1, 2)");

    // 1. Leads for Tenant 1 (Acme Innovations - Utsav)
    $leadsTenant1 = [
        [
            'name' => 'Rajesh Mehta',
            'company' => 'Mehta Textiles & Exports',
            'email' => 'rajesh@mehtatextiles.demo',
            'phone' => '+91 9825012345',
            'value' => 350000.00,
            'status' => 'new',
            'priority' => 'high',
            'source' => 'BNI Connect',
            'service_requirement' => 'ERP & Inventory Automation Suite',
            'assigned_to' => 3, // Aarav Sharma
            'source_lead_id' => 'BNI-AHM-2026-089',
            'last_contact_date' => null,
            'next_followup_date' => date('Y-m-d H:i:s', strtotime('-1 day 14:00:00')), // Overdue follow-up
            'notes' => 'Referred by BNI Zenith chapter member. Needs urgent demonstration of cloud stock management.'
        ],
        [
            'name' => 'Vikram Singhania',
            'company' => 'Singhania Logistics Hub',
            'email' => 'vikram@singhanialogistics.demo',
            'phone' => '+91 9879023456',
            'value' => 520000.00,
            'status' => 'contacted',
            'priority' => 'urgent',
            'source' => 'KVV Leads',
            'service_requirement' => 'Fleet Tracking & Route Optimization Engine',
            'assigned_to' => 3, // Aarav Sharma
            'source_lead_id' => 'KVV-2026-4412',
            'last_contact_date' => date('Y-m-d H:i:s', strtotime('-2 days')),
            'next_followup_date' => date('Y-m-d 15:30:00'), // Today's follow-up
            'notes' => 'Inquiry from KVV Business Portal. Initial call completed, promised quotation today afternoon.'
        ],
        [
            'name' => 'Dr. Ananya Roy',
            'company' => 'HealthFirst Diagnostic Center',
            'email' => 'ananya@healthfirst.demo',
            'phone' => '+91 9724034567',
            'value' => 420000.00,
            'status' => 'qualified',
            'priority' => 'medium',
            'source' => 'EAF Connect',
            'service_requirement' => 'Patient Appointment Portal & SMS Gateway',
            'assigned_to' => 2, // Pooja Patel (or user 2)
            'source_lead_id' => 'EAF-REF-8821',
            'last_contact_date' => date('Y-m-d H:i:s', strtotime('-3 days')),
            'next_followup_date' => date('Y-m-d H:i:s', strtotime('+2 days 11:00:00')), // Pending future
            'notes' => 'Met at EAF Annual Leadership Summit. Scope validated, scheduled technical walk-through.'
        ],
        [
            'name' => 'Siddharth Dave',
            'company' => 'Dave & Sons Infra Tech',
            'email' => 'siddharth@daveinfra.demo',
            'phone' => '+91 9909045678',
            'value' => 780000.00,
            'status' => 'proposal',
            'priority' => 'high',
            'source' => 'SEO / Website',
            'service_requirement' => 'Enterprise Multi-tenant SaaS Platform',
            'assigned_to' => 3, // Aarav Sharma
            'source_lead_id' => 'WEB-INBOUND-9901',
            'last_contact_date' => date('Y-m-d H:i:s', strtotime('-1 day')),
            'next_followup_date' => date('Y-m-d H:i:s', strtotime('+3 days 16:00:00')),
            'notes' => 'Inbound submission from official website pricing calculator. Proposal PDF sent.'
        ],
        [
            'name' => 'Pooja Chawla',
            'company' => 'Chawla Fashions Pvt Ltd',
            'email' => 'pooja@chawlafashions.demo',
            'phone' => '+91 9824056789',
            'value' => 250000.00,
            'status' => 'won',
            'priority' => 'medium',
            'source' => 'BNI Connect',
            'service_requirement' => 'E-Commerce B2B Wholesale Portal',
            'assigned_to' => 3,
            'source_lead_id' => 'BNI-AHM-2026-071',
            'last_contact_date' => date('Y-m-d H:i:s', strtotime('-5 days')),
            'next_followup_date' => null,
            'notes' => 'Deal won! Advance payment received and transferred to active customer onboarding.'
        ],
        [
            'name' => 'Nitin Bhavsar',
            'company' => 'Bhavsar Auto Spares',
            'email' => 'nitin@bhavsarauto.demo',
            'phone' => '+91 9898067890',
            'value' => 180000.00,
            'status' => 'lost',
            'priority' => 'low',
            'source' => 'Manual',
            'service_requirement' => 'Custom Billing & GST POS',
            'assigned_to' => 2,
            'source_lead_id' => 'MANUAL-001',
            'last_contact_date' => date('Y-m-d H:i:s', strtotime('-10 days')),
            'next_followup_date' => null,
            'notes' => 'Decided to continue using offline legacy software due to internal budget constraints.'
        ],
        [
            'name' => 'Gaurav Kothari',
            'company' => 'Kothari Agro Commodities',
            'email' => 'gaurav@kothariagro.demo',
            'phone' => '+91 9825078901',
            'value' => 650000.00,
            'status' => 'new',
            'priority' => 'high',
            'source' => 'SEO / Website',
            'service_requirement' => 'Mandi Price Intelligence & Trader CRM',
            'assigned_to' => null, // Unassigned!
            'source_lead_id' => 'WEB-INBOUND-9922',
            'last_contact_date' => null,
            'next_followup_date' => null, // Leads Without Follow-up!
            'notes' => 'Submitted website contact form 2 hours ago. Awaiting initial assignment and contact.'
        ]
    ];

    $leadStmt = $db->prepare("
        INSERT INTO crm_leads 
        (tenant_id, name, company, email, phone, value, status, priority, source, service_requirement, assigned_to, source_lead_id, last_contact_date, next_followup_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $leadIdMap = [];
    foreach ($leadsTenant1 as $l) {
        $leadStmt->execute([
            1, $l['name'], $l['company'], $l['email'], $l['phone'], $l['value'],
            $l['status'], $l['priority'], $l['source'], $l['service_requirement'],
            $l['assigned_to'], $l['source_lead_id'], $l['last_contact_date'],
            $l['next_followup_date'], $l['notes']
        ]);
        $leadIdMap[$l['source_lead_id']] = (int)$db->lastInsertId();
    }

    // 2. Leads for Tenant 2 (Nexus Digital - Rahul) - Strictly Isolated
    $leadsTenant2 = [
        [
            'name' => 'Deepak Shah',
            'company' => 'Shah Chemical Industries',
            'email' => 'deepak@shahchem.demo',
            'phone' => '+91 9876541122',
            'value' => 400000.00,
            'status' => 'contacted',
            'priority' => 'high',
            'source' => 'BNI Connect',
            'service_requirement' => 'Hazardous Material Dispatch Tracker',
            'assigned_to' => 5, // Sneha Joshi
            'source_lead_id' => 'BNI-MUM-2026-101',
            'last_contact_date' => date('Y-m-d H:i:s', strtotime('-1 day')),
            'next_followup_date' => date('Y-m-d H:i:s', strtotime('+1 day 11:30:00')),
            'notes' => 'Nexus client inquiry via BNI South Mumbai.'
        ]
    ];

    foreach ($leadsTenant2 as $l) {
        $leadStmt->execute([
            2, $l['name'], $l['company'], $l['email'], $l['phone'], $l['value'],
            $l['status'], $l['priority'], $l['source'], $l['service_requirement'],
            $l['assigned_to'], $l['source_lead_id'], $l['last_contact_date'],
            $l['next_followup_date'], $l['notes']
        ]);
        $leadIdMap[$l['source_lead_id']] = (int)$db->lastInsertId();
    }

    echo " - Seeded " . count($leadsTenant1) . " leads for Tenant 1 and " . count($leadsTenant2) . " leads for Tenant 2\n";

    // 3. Create Corresponding Follow-ups for Tenant 1
    $followStmt = $db->prepare("
        INSERT INTO follow_ups
        (tenant_id, lead_id, assigned_to, title, contact_method, notes, outcome, scheduled_at, status, completed_at, reminder_time, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $actStmt = $db->prepare("
        INSERT INTO lead_activities
        (tenant_id, lead_id, user_id, activity_type, title, description, activity_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");

    // Overdue Follow-up for Rajesh Mehta (BNI)
    $rajeshId = $leadIdMap['BNI-AHM-2026-089'];
    $followStmt->execute([
        1, $rajeshId, 3, 'Follow-up on BNI Referral: Mehta Textiles Demo',
        'call', 'Schedule interactive live ERP demonstration session with production manager.',
        null, date('Y-m-d H:i:s', strtotime('-1 day 14:00:00')), 'pending', null,
        date('Y-m-d H:i:s', strtotime('-1 day 13:00:00')), 2
    ]);
    $actStmt->execute([
        1, $rajeshId, 2, 'import', 'Lead Imported from BNI Connect',
        'Received referral slip from BNI Zenith chapter member. Automated lead capture.',
        date('Y-m-d H:i:s', strtotime('-3 days'))
    ]);

    // Today's Follow-up for Vikram Singhania (KVV)
    $vikramId = $leadIdMap['KVV-2026-4412'];
    $followStmt->execute([
        1, $vikramId, 3, 'KVV Lead Quote Presentation & Demo',
        'meeting', 'Call Mr. Singhania to present live quotation for GPS integration.',
        null, date('Y-m-d 15:30:00'), 'pending', null,
        date('Y-m-d 15:00:00'), 2
    ]);
    $actStmt->execute([
        1, $vikramId, 3, 'call', 'Discovery Phone Call Completed',
        'Spoke with operations head Vikram Singhania. Identified fleet size of 45 vehicles.',
        date('Y-m-d H:i:s', strtotime('-2 days'))
    ]);
    $actStmt->execute([
        1, $vikramId, 3, 'whatsapp', 'Catalog Sent via WhatsApp',
        'Sent PDF product brochure and technical specs to +91 9879023456.',
        date('Y-m-d H:i:s', strtotime('-1 day'))
    ]);

    // Future Pending Follow-up for Dr. Ananya Roy (EAF)
    $ananyaId = $leadIdMap['EAF-REF-8821'];
    $followStmt->execute([
        1, $ananyaId, 2, 'EAF Diagnostic Portal Tech Walkthrough',
        'meeting', 'Online Google Meet walkthrough of patient portal integration.',
        null, date('Y-m-d H:i:s', strtotime('+2 days 11:00:00')), 'pending', null,
        date('Y-m-d H:i:s', strtotime('+2 days 10:30:00')), 2
    ]);
    $actStmt->execute([
        1, $ananyaId, 2, 'email', 'Introductory Deck Emailed',
        'Sent company introduction deck and healthcare portfolio references.',
        date('Y-m-d H:i:s', strtotime('-3 days'))
    ]);

    // Future Pending Follow-up for Siddharth Dave (SEO / Website)
    $daveId = $leadIdMap['WEB-INBOUND-9901'];
    $followStmt->execute([
        1, $daveId, 3, 'Commercial Terms Review with Siddharth Dave',
        'call', 'Discuss proposal pricing, implementation milestones and SLA terms.',
        null, date('Y-m-d H:i:s', strtotime('+3 days 16:00:00')), 'pending', null,
        date('Y-m-d H:i:s', strtotime('+3 days 15:00:00')), 2
    ]);
    $actStmt->execute([
        1, $daveId, 3, 'email', 'Detailed Proposal Dispatched',
        'Emailed customized enterprise SaaS proposal and project scope document.',
        date('Y-m-d H:i:s', strtotime('-1 day'))
    ]);

    // Completed Follow-up for Pooja Chawla (Won Lead)
    $poojaId = $leadIdMap['BNI-AHM-2026-071'];
    $followStmt->execute([
        1, $poojaId, 3, 'Contract Finalization & Advance Cheque',
        'meeting', 'Met at client office in Ahmedabad to sign contract agreement.',
        'Contract executed. Initial 50% milestone advance received.',
        date('Y-m-d H:i:s', strtotime('-5 days 11:00:00')), 'completed',
        date('Y-m-d H:i:s', strtotime('-5 days 12:30:00')), null, 2
    ]);
    $actStmt->execute([
        1, $poojaId, 3, 'status_change', 'Lead Converted to Won Account',
        'Lead status changed from proposal to won. Created client onboarding ticket.',
        date('Y-m-d H:i:s', strtotime('-5 days'))
    ]);

    // Follow-up for Tenant 2 (Deepak Shah)
    $deepakId = $leadIdMap['BNI-MUM-2026-101'];
    $followStmt->execute([
        2, $deepakId, 5, 'Chemical Logistics Briefing Call',
        'call', 'Discuss safety compliance module requirements with Deepak Shah.',
        null, date('Y-m-d H:i:s', strtotime('+1 day 11:30:00')), 'pending', null,
        date('Y-m-d H:i:s', strtotime('+1 day 11:00:00')), 4
    ]);

    echo " - Seeded follow-ups and lead activities successfully!\n";
    echo "Centralized leads seeding finished.\n";
} catch (\Throwable $e) {
    echo "Seeding Error: " . $e->getMessage() . "\n";
    exit(1);
}
