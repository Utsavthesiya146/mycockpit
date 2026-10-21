# 🚆 MY COCKPIT AI — Railway.app Deployment Guide (Vercel Alternative)

Railway (railway.app) allows you to deploy **React Frontend + PHP Backend + MySQL Database** all together connected to your GitHub repository, just like Vercel.

---

## 🚀 Step 1: Push Code to GitHub
Ensure your code is pushed to your GitHub repository:
```powershell
cd "d:\xampp\htdocs\my cockpit"
git init
git add .
git commit -m "feat: complete my cockpit ai platform ready for railway"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
git push -u origin main
```

---

## 🗄️ Step 2: Create a MySQL Database on Railway
1. Open [railway.app](https://railway.app) and log in with your **GitHub** account.
2. Click **"New Project"**.
3. Select **"Provision MySQL"**.
4. Railway will create a live MySQL server in 5 seconds and display:
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
   - `MYSQLDATABASE`
5. Click on the MySQL database service in Railway, go to the **Data** tab, and run or import `database/migrations/001_initial_schema.sql` (and optionally `database/seeds/002_demo_seeds.sql`).

---

## ⚡ Step 3: Deploy the App (Frontend + Backend)
1. In the same Railway Project canvas, click **"New"** (or "+ Service").
2. Select **"GitHub Repo"** and choose your repository.
3. Railway will automatically detect the root `Dockerfile` we created, compile the React Vite frontend, build the PHP Apache server, and launch the application!
4. Click on your deployed web service, go to **Settings** → **Networking** → Click **"Generate Domain"**.
5. Railway will give you a live HTTPS domain like:
   `https://my-cockpit-ai-production.up.railway.app`

---

## 🔗 Automatic Database Linking
Because we configured `backend/config/Database.php` to automatically check Railway's environment variables (`MYSQLHOST`, `MYSQLUSER`, etc.), your PHP backend will automatically connect to Railway's MySQL database with zero manual configuration!
