# WinJobApplier - Full Project Overview & Architecture Guide

Welcome to the documentation for **WinJobApplier**! This document provides a complete, high-level overview of the project's purpose, architectural stack, data flow, and workflow. It is designed to be easily read by developers, code reviewers, and non-technical stakeholders alike.

---

## 1. What is WinJobApplier?
**WinJobApplier** is an intelligent, automated job application dashboard and tracker. 
Its core goal is to help candidates discover and match with jobs efficiently by:
1. **Scraping**: Automatically scanning major job engines (like Adzuna) for listings matching their desired skills and location.
2. **Tracking**: Providing a Kanban-like list board to manage application statuses (Pending, Applied, Interviewing, Offered, Rejected).
3. **ATS Scorecard Matching**: Utilizing advanced Generative AI (Google's **Gemini-2.5-Flash**) to parse candidate resumes against job descriptions, calculate a compatibility score, and generate keyword optimization checklists.

---

## 2. System Architecture Stack

The project is built as a modular, decoupled full-stack application spanning across four distinct layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Vite + React Frontend (UI)                   │
│         Renders the Job Board, settings profiles, and modal.     │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                        HTTP API Requests
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                   FastAPI Python Server (Backend)               │
│        Handles PDF extraction, routes, and talks to Gemini API. │
└──────┬───────────────────────────────────────────────────┬──────┘
       │                                                   │
   SQL Queries                                        Launches Scraper
       │                                                   │
┌──────▼─────────────────────────┐               ┌─────────▼──────┐
│   Supabase Hosted PostgreSQL   │               │  Rust Scraper  │
│   Stores settings and job lists.│               │  Fetches APIs. │
└────────────────────────────────┘               └────────────────┘
```

### 💻 A. Frontend Layer (React + Vite)
* **Tech Stack**: React 18, Vite (build tool), Vanilla CSS (glassmorphism/dark theme).
* **Role**: The visual cockpit for the user. Allows managing job statuses, uploading resumes, configuring parameters, and displaying the ATS scorecard details.

### ⚙️ B. Backend Server Layer (FastAPI)
* **Tech Stack**: Python 3.11+, FastAPI (REST API framework), `pypdf` (resume parsing), `urllib` (direct network requests to Gemini API).
* **Role**: Acts as the system controller. Coordinates database transactions, parses candidate resumes, handles file uploads, and securely manages AI requests with error retries.

### 🦀 C. Job Scraper Layer (Rust)
* **Tech Stack**: Rust, `reqwest` (HTTP requests), `postgres` (database interface), `serde_json` (JSON parsing).
* **Role**: A compiled Rust binary built for speed. It is executed to query the Adzuna API, crawl matching job postings, analyze simple word overlap, and write new results directly to the database.

### 🗄️ D. Database Layer (Supabase PostgreSQL)
* **Tech Stack**: Hosted PostgreSQL on Supabase Cloud, Supabase Auth.
* **Role**: Stores persistent data in relational tables (`jobs` and `settings`), and handles client auth (signup/login) secure session tokens.

---

## 3. High-Level Data Flow

Here is how data flows through the application during core operations:

### 📥 Flow 1: Job Discovery & Scraping
1. User enters target **Keywords** (e.g., `Rust, React`), **Country**, and **State** in Profile Settings and clicks **Save**.
2. React frontend sends settings to FastAPI backend which saves them to Supabase.
3. The backend immediately triggers the compiled **Rust Scraper** executable.
4. The Rust scraper reads user preferences from the database, builds request URLs, and queries the **Adzuna REST API**.
5. Scraper parses Adzuna's JSON output, removes duplicates, and inserts the new job listings into the `jobs` table in PostgreSQL.
6. Frontend refreshes and displays the new jobs on the Job Board.

### 🧠 Flow 2: ATS Resume Compatibility Analysis
1. User clicks on a job card on the Job Board to open the **Job Details Modal**.
2. User clicks **Analyze Resume Compatibility**.
3. Frontend dispatches a trigger request to FastAPI backend `/api/winjobapplier/jobs/{id}/ats-analyze`.
4. Backend fetches the job description and candidate's parsed resume text from PostgreSQL.
5. Backend constructs a recruiter prompt and queries the **Gemini-2.5-Flash** API (with built-in retry handling for 503 errors).
6. Gemini responds with a structured JSON object containing the overall match score ($0 - 100\%$), matching keywords, missing keywords, and tailoring tips.
7. Backend updates the job record with these values and returns them to the React frontend.
8. Frontend immediately updates the score badge, renders the gauge, and lists the tags and recommendations.

---

## 4. Other Technical Documentation Guides
For in-depth details about specific components, review the companion guides in the [documents/](file:///d:/WinJobApplier/documents/) folder:
* **[Supabase & Database Setup](file:///d:/WinJobApplier/documents/supabase_integration_guide.md)**: Details on authentication flows and PostgreSQL table schemas.
* **[Backend & APIs Overview](file:///d:/WinJobApplier/documents/backend_overview_guide.md)**: A line-by-line function list, endpoint definitions, and AI retry logic.
* **[Frontend Architecture Guide](file:///d:/WinJobApplier/documents/frontend_architecture_guide.md)**: Detail on React states, UI render rules, and components.
* **[Adzuna Scraper Integration](file:///d:/WinJobApplier/documents/adzuna_integration_guide.md)**: Details of the Rust job scraping engine.
* **[Google Gemini API Guide](file:///d:/WinJobApplier/documents/gemini_integration_guide.md)**: Explanation of AI prompts, JSON schemas, and model settings.
