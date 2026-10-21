# 🚀 MY COCKPIT AI — Local Development & Daily Setup Guide

> **Tagline:** One Dashboard. Every Business. Your Personal AI.  
> **Environment:** Windows 10 | Antigravity IDE | XAMPP (Apache + MySQL) | React + Vite + TypeScript + Tailwind CSS

---

## 📋 System Prerequisites Verified
- **PHP:** 8.2.12 (XAMPP at `D:\xampp\php\php.exe`)
- **MySQL / MariaDB:** 10.4.32 (XAMPP at `D:\xampp\mysql\bin\mysql.exe`)
- **Web Server:** Apache 2.4 (listening on port 80)
- **Node.js:** v24.16.0 | **npm:** 11.13.0
- **Android SDK:** Installed at `%LOCALAPPDATA%\Android\Sdk` | JDK 17 (Eclipse Temurin)

---

## 🛠️ Step 1: Start XAMPP Services
1. Open **XAMPP Control Panel**.
2. Start **Apache** (verify port 80 / 443 is green).
3. Start **MySQL** (verify port 3306 is green).
4. Verify phpMyAdmin is accessible at:
   👉 [http://localhost/phpmyadmin](http://localhost/phpmyadmin)

---

## 🗄️ Step 2: Database Initialization (One-Time Setup)
The development database is named `mycockpit_dev`.

To re-run migrations and load fresh synthetic seed data at any time:
```powershell
# In PowerShell:
D:\xampp\mysql\bin\mysql.exe -u root mycockpit_dev < database\migrations\001_initial_schema.sql
D:\xampp\mysql\bin\mysql.exe -u root mycockpit_dev < database\seeds\002_demo_seeds.sql
```

---

## 💻 Step 3: Start the Frontend Application
In Antigravity IDE terminal (or PowerShell):
```powershell
cd "d:\xampp\htdocs\my cockpit\frontend"
npm run dev
```
The application will launch immediately at:
👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🔑 Pre-Configured Demo Accounts (1-Click Login Available)

| Account Type | Email | Password | Tenant / Role | Personal Client URL |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@mycockpit.ai` | `AdminPassword123!` | System Fleet (`super_admin`) | `http://localhost:5173/admin` |
| **Client A (Acme)** | `utsav@acme.com` | `Password123!` | Acme Innovations (`tenant_owner`) | `http://localhost:5173/utsav` |
| **Client B (Nexus)** | `rahul@nexus.com` | `Password123!` | Nexus Digital (`tenant_owner`) | `http://localhost:5173/rahul` |

> 💡 **Quick Switcher:** Once on the login screen or inside the top navigation bar, you can click the quick demo buttons to seamlessly toggle between Super Admin, Client A, and Client B to test tenant isolation.

---

## 🧪 Step 4: Run Automated Verification Tests
Run the PHP verification test suite to validate database integrity, JWT encryption, tenant isolation, and decimal financial math:
```powershell
php tests/test_suite.php
# Or using full XAMPP path:
& "D:\xampp\php\php.exe" "tests/test_suite.php"
```
**Expected Output:**
```
=======================================================
   MY COCKPIT AI - VERIFICATION & ISOLATION SUITE      
=======================================================
 [PASS] Database Connection
 [PASS] JWT Encoding & Decoding
 [PASS] JWT Tamper Rejection
 [PASS] Tenant Isolation CRM Customers
 [PASS] Zero Invoice ID Overlap between Tenants
 [PASS] Client A Invoices contain INV-UTS-001
 [PASS] Client B Invoices contain INV-NX-101
 [PASS] Accurate Decimal Financial Calculations for Tenant 1
 [PASS] Invoice Outstanding Balance Integrity
 [PASS] Cross-Tenant Query Block
=======================================================
TEST SUMMARY: 10 Passed, 0 Failed
=======================================================
```

---

## 📱 Mobile Application (Capacitor)
Android project files are located in `mobile/android` (linked to `frontend/android`).
To open and run the Android Studio project:
```powershell
cd "d:\xampp\htdocs\my cockpit\frontend"
npx cap open android
```
*(Note: iOS builds require macOS and Xcode).*
