# Supabase & Database Integration Guide

This guide explains how Supabase is integrated into the `WinJobApplier` project, how to get your connection details, and the logic behind database tables and user authentication.

---

## 1. What is Supabase in this Project?
[Supabase](https://supabase.com/) is an open-source Firebase alternative built on top of **PostgreSQL**.
In this project, Supabase handles two core functions:
1. **User Authentication**: Login, Sign-up, password validation, and active user session tracking.
2. **PostgreSQL Database Hosting**: Storing job postings list details, scraper keywords, profile settings, and ATS scorecard analysis values.

---

## 2. How to Set Up Supabase & Get Your Credentials

1. Go to **[Supabase.com](https://supabase.com/)** and sign up or log in.
2. Click **New Project** and create a project (e.g. `WinJobApplier`). Save your database password securely.
3. Once the project is active, navigate to the **Project Settings** (gear icon on sidebar) -> **API** to copy:
   * **Project URL**: Found under API Settings as `URL`.
   * **Anon Public Key**: Found under API Settings as `anon public`.
4. Navigate to **Project Settings** -> **Database** to copy:
   * **Connection String (Transaction/URI)**: Look for **URI** connection string under Connection Strings pooler.
5. Put these credentials in your `.env` files:
   * **Root [`.env`](file:///d:/WinJobApplier/.env)** (Used by Backend and Scraper):
     ```env
     DATABASE_URL="postgresql://postgres.xxx:password@aws-xx-pooler.supabase.com:5432/postgres?sslmode=require"
     ```
   * **Frontend [`frontend/.env`](file:///d:/WinJobApplier/frontend/.env)** (Used by React):
     ```env
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1Ni...
     ```

---

## 3. Database Table Structures
The database tables are automatically initialized by [db_init.py](file:///d:/WinJobApplier/db_init.py):
* **`jobs` Table**:
  Stores scraped job listings,guid hash, company name, url, posted date, status (pending, applied, offered, etc.), and custom ATS metrics (`ats_score`, `ats_matching`, `ats_missing`, `ats_recommendations`).
* **`settings` Table**:
  Stores the candidate profile details, target country (India, US, UK, Canada), keywords (comma-separated), target city/state, and the extracted PDF resume text.

---

## 4. Authentication Flow Logic

1. **User Registration**:
   In `Login.jsx`, clicking "Sign Up" triggers `supabase.auth.signUp({ email, password })`. Supabase handles account registration and returns session tokens.
2. **User Login**:
   In `Login.jsx`, clicking "Sign In" triggers `supabase.auth.signInWithPassword({ email, password })`. If successful, Supabase returns the active user session.
3. **Session Synchronization**:
   In `App.jsx`, a `useEffect` hook registers a listener:
   ```javascript
   supabase.auth.onAuthStateChange((_event, session) => {
     setSession(session);
   });
   ```
   If a session exists, the dashboard loads; otherwise, the user is redirected to the login screen.
4. **Sign Out**:
   In `App.jsx` sidebar, clicking "Sign Out" triggers `supabase.auth.signOut()`, which clears the cookie tokens and redirects the user back to the login screen.
