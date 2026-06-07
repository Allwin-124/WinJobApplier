# Frontend Component Architecture Guide

This guide describes the structure, components, logic, and state flow of the React-based frontend dashboard for the `WinJobApplier` workspace.

---

## 1. Application Files & Responsibilities

### 📄 [frontend/src/App.jsx](file:///d:/WinJobApplier/frontend/src/App.jsx)
The primary React container and entry point for the dashboard view.
* **Responsibilities**:
  * Manages active user authentication session.
  * Synchronizes and displays job postings data list.
  * Coordinates dashboard metrics calculation (Applied, Interviews, Offers, Rejections).
  * Handles local search queries and dropdown status filters.
  * Coordinates layout toggles (Job Application Board vs Profile Settings).
* **Key States**:
  * `session`: Stores Supabase user login state (or `null`).
  * `jobs`: Array of scraped job posting records.
  * `selectedJob`: Holds the job object currently opened in the details modal.
  * `settings`: Candidate profile information (Name, Email, Resume, Target Country/State, Search Keywords).
  * `searchQuery` & `statusFilter`: Filter parameters for job board grid.
* **Core Functions**:
  * `fetchJobs()`: GET request to `/api/winjobapplier/jobs` to load listings.
  * `fetchSettings()`: GET request to `/api/winjobapplier/settings` to load profile data.
  * `handleStatusChange(jobId, newStatus)`: Updates job pipeline state (e.g. Applied, Offered) in the database.
  * `handleResumeUpload(e)`: Uploads PDF/Word resume to `/api/winjobapplier/settings/resume` and updates local state.
  * `handleSettingsSubmit(e)`: Saves profile changes, redirects to Job Board, and automatically triggers background job scraping.

---

### 📄 [frontend/src/components/Login.jsx](file:///d:/WinJobApplier/frontend/src/components/Login.jsx)
Handles the user landing screen when there is no active session.
* **Responsibilities**:
  * Renders registration and login tab forms.
  * Displays user validation errors (e.g., password mismatch, registration errors).
* **Core Functions**:
  * `handleLogin(e)`: Contacts Supabase Authentication service using `signInWithPassword`.
  * `handleRegister(e)`: Contacts Supabase Authentication using `signUpWithPassword` to register new users.

---

### 📄 [frontend/src/components/JobDetailsModal.jsx](file:///d:/WinJobApplier/frontend/src/components/JobDetailsModal.jsx)
A pop-up modal showing detailed information and the ATS compatibility scorecard for a selected job.
* **Responsibilities**:
  * Renders full job descriptions scrollable card.
  * Displays a color-coded circular scorecard gauge.
  * Populates green tags for matching skills and red tags for missing skills.
  * Displays a checklist of AI-generated tailoring tips.
* **Core Functions**:
  * `handleAnalyze()`: Sends `POST /api/winjobapplier/jobs/{job_id}/ats-analyze` to trigger the backend Gemini analyzer.
  * `onUpdateJob(jobId, fields)`: Callback triggering parent state synchronization to update the scorecard immediately on the dashboard.
  * `getScoreColorClass(score)`: Returns CSS classes for visual scorecard colors: Green for Match score $\ge 80$, Yellow for $\ge 50$, Red for $<50$.

---

### 📄 [frontend/src/supabase.js](file:///d:/WinJobApplier/frontend/src/supabase.js)
Initializes the Supabase JavaScript client wrapper.
* **Responsibilities**:
  * Exports `supabase` connection object.
  * Reads project environment parameters: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
