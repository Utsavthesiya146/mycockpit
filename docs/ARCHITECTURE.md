# 🏛️ MY COCKPIT AI — Architecture & Multi-Tenant Blueprint

## 1. High-Level System Architecture

```
[ Browser / Capacitor Mobile App (React 19 + TypeScript) ]
                          │
            REST JSON API Requests (Bearer JWT)
                          ▼
             [ Apache Web Server (XAMPP / Hostinger) ]
                          │
                          ▼
            [ PHP 8.2 API Front Controller ]
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
  [ AuthMiddleware ]             [ TenantMiddleware ]
  (Verifies JWT & Status)        (Enforces Strict Tenant Isolation)
          │                               │
          └───────────────┬───────────────┘
                          ▼
                 [ Controllers ]
   (CRM, Invoices, Financial, Tasks, AI Agent, AppHub)
                          │
                          ▼
          [ MySQL 8 / MariaDB (mycockpit_dev) ]
       (Filtered by tenant_id on ALL entity queries)
```

## 2. Multi-Tenant Isolation Guarantee
1. **Zero Trust for Client-Supplied Tenant IDs:** The frontend cannot spoof `tenant_id`. Every tenant-scoped request resolves `tenant_id` exclusively from the authenticated user's server-verified JWT token.
2. **Foreign Key Integrity:** All entity tables (`crm_customers`, `crm_leads`, `invoices`, `tasks`, `calendar_events`, `follow_ups`, `connected_apps`, `ai_conversations`) enforce foreign key constraints with `ON DELETE CASCADE` referencing `tenants(id)`.
3. **Database Transactions:** Invoices and payment recordings utilize atomic transactions with `FOR UPDATE` row locking to prevent race conditions or fractional rounding drift.
4. **AI Boundary:** Personal AI Assistant queries execute prepared PDO statements scoped to the verified `tenant_id`.
