# MY COCKPIT AI — Production Readiness & Deployment Guide

**Target System:** MY COCKPIT AI  
**Deployment Infrastructure:** Render.com (Web Service Docker) + TiDB Cloud (Serverless MySQL)  
**Live Production URL:** [https://mycockpit-0e86.onrender.com](https://mycockpit-0e86.onrender.com)  
**GitHub Repository:** [https://github.com/Utsavthesiya146/mycockpit](https://github.com/Utsavthesiya146/mycockpit)

---

## 1. Architecture Overview

MY COCKPIT AI is packaged as an optimized, multi-stage Docker container:

```text
+-------------------------------------------------------------+
| Stage 1: Frontend Build (Node.js 20 Alpine)                  |
| - Compiles React 19 + TypeScript + Vite into /dist          |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| Stage 2: Production Runtime (PHP 8.2 Apache)                 |
| - Serves static frontend bundles via Apache                 |
| - Executes PHP REST API via mod_php                          |
| - Connects to TiDB Cloud Serverless MySQL via PDO + SSL CA  |
+-------------------------------------------------------------+
```

---

## 2. Environment Configuration

The following environment variables are configured on Render Web Service:

| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `DB_HOST` | TiDB Cloud endpoint hostname | `gateway01.ap-southeast-1.prod.aws.tidbcloud.com` |
| `DB_PORT` | TiDB Cloud serverless port | `4000` |
| `DB_NAME` | Database schema name | `test` |
| `DB_USER` | TiDB Cloud SQL username | `4Buh23BouidWBmU.root` |
| `DB_PASS` | TiDB Cloud SQL password | `jl894oZv9LbZS9I6` |
| `DB_SSL` | Force SSL connection flag | `true` |
| `JWT_SECRET` | Secret key for signing JWT tokens | `cockpit_jwt_production_secret_key_2026` |
| `APP_ENV` | Application environment | `production` |

---

## 3. Security & Compliance Checklist

- [x] **Secure Transport (TLS 1.2+):** Strict SSL enforcement using Mozilla Root CA certificates (`backend/config/cacert.pem`) for all database operations.
- [x] **Password Protection:** Passwords securely hashed with `PASSWORD_DEFAULT` (bcrypt with automatic salt generation).
- [x] **SQL Injection Defense:** All queries utilize PDO prepared statements with strict parameter binding.
- [x] **Tenant Boundary Isolation:** Tenant ID scoping strictly enforced on every database query.
- [x] **JWT Authentication:** Stateless, tamper-resistant tokens carrying user role and tenant context.
- [x] **CORS Configuration:** Dynamic origin reflection with security headers for authorized frontend origins.
- [x] **Error Handling:** Database exceptions logged securely without leaking stack traces or credentials to clients.

---

## 4. Verification & Testing Instructions

1. **Visit Live Application:** Navigate to [https://mycockpit-0e86.onrender.com](https://mycockpit-0e86.onrender.com).
2. **One-Click Demo Authentication:**
   - **Super Admin:** Click the gold **Super Admin Portal** badge (`admin@mycockpit.ai`).
   - **Client A:** Click the blue **Client A: Acme Innovations** badge (`utsav@acme.com`).
   - **Client B:** Click the teal **Client B: Nexus Digital** badge (`rahul@nexus.com`).
3. **Verify Modules:**
   - Check financial totals and revenue charts on the Dashboard.
   - Navigate to **Invoices** to view live tenant invoices and generate new tax invoices.
   - Test **CRM** leads and deal pipeline updates.
   - Explore **Tasks**, **Calendar**, and **HRM** records.
