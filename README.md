# 🚀 MY COCKPIT AI
### *One Dashboard. Every Business. Your Personal AI.*

[![PHP 8.2](https://img.shields.io/badge/PHP-8.2.12-777BB4?style=flat-square&logo=php&logoColor=white)](https://php.net)
[![React 19](https://img.shields.io/badge/React-19.3-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite 8](https://img.shields.io/badge/Vite-8.3-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![MySQL](https://img.shields.io/badge/MariaDB-10.4-003545?style=flat-square&logo=mariadb&logoColor=white)](https://mariadb.org)
[![Capacitor](https://img.shields.io/badge/Capacitor-Mobile_Ready-119EFF?style=flat-square&logo=capacitor&logoColor=white)](https://capacitorjs.com)
[![Hostinger](https://img.shields.io/badge/Deployment-Hostinger_Ready-673DE6?style=flat-square&logo=hostinger&logoColor=white)](https://hostinger.com)

---

## 📖 Executive Summary
**MY COCKPIT AI** is a production-oriented, multi-tenant enterprise management SaaS platform. It combines CRM, HRM, Calendar, Action Items, Customer Follow-ups, Commercial Invoicing, and a Personal AI Copilot into a unified cockpit.

Every client tenant workspace is cryptographically isolated at the database, session, and AI levels—allowing enterprise organizations to operate their entire business from a single command center.

---

## ⚡ Core Feature Matrix

| Feature | Capabilities |
| :--- | :--- |
| **Multi-Tenant System (Phase 1)** | Super Admin fleet governance, custom organization URL slugs (e.g. `akiradigital.com/utsav`), client registration, secure bcrypt authentication, and strict tenant isolation. |
| **Financial Intelligence (Phase 2)** | Real-time calculation of Total Receivable, Total Received, Pending Amount, and Overdue balances. Line-item invoice generation with 18% GST tax calculation and atomic partial payments via MySQL transactions. |
| **CRM & Sales Pipeline (Phase 2)** | Customer directory, tax IDs, contact tracking, and 5-stage sales pipeline with deal value metrics. |
| **HRM & Workforce (Phase 2)** | Department directory, employee compensation baselines, and status tracking. |
| **Calendar & Operations (Phase 2)** | Timeline scheduling of client meetings, appointments, and urgent task milestones. |
| **Client Follow-ups (Phase 2)** | Scheduled relationship touches with automatic overdue detection and one-click completion. |
| **Connected Apps Hub (Phase 3)** | Direct integration and website launchers for Google Calendar, Gmail, Google Drive, BNI Connect, KVV, Right Form, and custom portals. |
| **Personal AI Agent (Phase 4)** | Natural language business querying with live MySQL execution, source citations, guardrails for consequential actions, and configurable AI providers. |
| **Mobile Applications (Phase 5)** | Capacitor configuration with native Android project ready for compilation. |

---

## 🏛️ Project Directory Structure
```
D:\MyCockpitAI (linked to d:\xampp\htdocs\my cockpit)
├── frontend/             # React 19 + Vite + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/   # Sidebar, Header, MetricCard, Modal, Badge
│   │   ├── context/      # AuthContext with 1-click Demo Account Switcher
│   │   ├── pages/        # Dashboard, Invoices, CRM, HRM, AI, Apps, etc.
│   │   └── services/     # Unified API Client
│   └── dist/             # Static production build
├── backend/              # Clean PHP 8.2 Object-Oriented Architecture
│   ├── api/              # Unified Front Controller (index.php) & .htaccess
│   ├── config/           # Database PDO connection & System Configuration
│   ├── controllers/      # Auth, Tenant, Dashboard, Invoices, AI, etc.
│   ├── middleware/       # AuthMiddleware (JWT) & TenantMiddleware (Strict Isolation)
│   └── utils/            # JWT Encoder/Decoder & Response Handlers
├── database/
│   ├── migrations/       # 001_initial_schema.sql (17 UTF8mb4 Tables)
│   └── seeds/            # 002_demo_seeds.sql (Super Admin, Client A, Client B)
├── mobile/               # Native Android Capacitor Project Scaffold
├── tests/                # Automated PHP Tenant Isolation & Math Test Suite
├── docs/                 # Architectural specifications
├── LOCAL_SETUP.md        # Step-by-step daily development guide
├── TESTING_CHECKLIST.md  # Testing matrix and pass reports
└── HOSTINGER_DEPLOYMENT.md # Hostinger cloud deployment instructions
```

---

## 🏃 Quick Start Guide
1. **Ensure XAMPP is Running:** Start Apache (port 80) and MySQL (port 3306).
2. **Start the Frontend:**
   ```powershell
   cd frontend
   npm run dev
   ```
3. **Open in Browser:** Navigate to `http://localhost:5173/`.
4. **Log in:** Use any of the 1-click demo accounts on the login screen (`Super Admin`, `Client A [Utsav]`, `Client B [Rahul]`).

---

## 🧪 Run Automated Verification Tests
```powershell
php tests/test_suite.php
```
*Validates database connectivity, JWT security, zero cross-tenant leakage, and decimal invoice math.*
