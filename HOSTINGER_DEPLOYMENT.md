# 🌐 MY COCKPIT AI — Hostinger Production Deployment Guide

This guide details how to deploy **MY COCKPIT AI** to Hostinger Premium / Business Shared Cloud Hosting running **Apache**, **PHP 8.2+**, and **MySQL 8.x / MariaDB**.

---

## 🏗️ Architecture Overview on Hostinger
```
public_html/
│
├── index.html              <-- React Production Build (dist/index.html)
├── assets/                 <-- React Compiled CSS & JS bundles (dist/assets/)
├── favicon.svg             <-- Favicon
├── .htaccess               <-- Frontend SPA router & API redirect rules
│
├── backend/
│   ├── api/
│   │   ├── index.php       <-- Unified API Front Controller
│   │   └── .htaccess       <-- API Routing to index.php
│   ├── config/             <-- Database.php, Config.php
│   ├── controllers/        <-- Auth, CRM, Invoices, AI, etc.
│   ├── middleware/         <-- AuthMiddleware, TenantMiddleware
│   └── utils/              <-- JWT, Response
```

---

## 🗄️ Step 1: Database Setup via Hostinger hPanel
1. Log in to **Hostinger hPanel**.
2. Navigate to **Databases** → **MySQL Databases**.
3. Create a new database:
   - **Database Name:** `u594406910_mycockpit` (example prefix)
   - **Username:** `u594406910_user`
   - **Password:** Generate a strong random password.
4. Click **Enter phpMyAdmin** next to the newly created database.
5. In phpMyAdmin, go to the **Import** tab:
   - Upload and execute `database/migrations/001_initial_schema.sql`
   - (Optional) Upload `database/seeds/002_demo_seeds.sql` if you desire default test data.

---

## ⚙️ Step 2: Configure Backend Environment
Edit `backend/config/Database.php` or create a `.env` in your root:
```php
$host = 'localhost'; // Standard on Hostinger
$dbName = 'u594406910_mycockpit';
$user = 'u594406910_user';
$password = 'YourStrongPasswordHere';
```

---

## 📦 Step 3: Build & Upload the React Frontend
On your local computer, build the production static bundle:
```powershell
cd "d:\xampp\htdocs\my cockpit\frontend"
npm run build
```
This generates the optimized bundle in `frontend/dist/`.

Upload the contents of `frontend/dist/` directly into your Hostinger `public_html/` folder.

---

## 🛡️ Step 4: Configure Apache `.htaccess` in `public_html`
Create or update `public_html/.htaccess` with the following rules to ensure that personal client vanity URLs (`akiradigital.com/utsav`) and API routes work flawlessly:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    # 1. Route API requests to PHP Backend
    RewriteRule ^api/(.*)$ backend/api/index.php/$1 [QSA,L]

    # 2. Exclude existing static files and backend folders
    RewriteCond %{REQUEST_FILENAME} -f [OR]
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^ - [L]

    # 3. Route all other client URLs (e.g. /utsav, /rahul) to React index.html
    RewriteRule ^ index.html [L]
</IfModule>
```

---

## 🔒 Step 5: SSL & Security Audit
1. Enable **Free Let's Encrypt SSL** in Hostinger hPanel → **SSL**.
2. Force HTTPS redirection in `.htaccess`:
   ```apache
   RewriteCond %{HTTPS} off
   RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
   ```
3. Set PHP version to **PHP 8.2** or **PHP 8.3** in **hPanel** → **PHP Configuration**.
4. Confirm `display_errors` is set to `Off` in production.
