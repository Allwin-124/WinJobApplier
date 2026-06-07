# Backend Services & API Guide (Plain English Overview)

This document provides a simple, human-readable breakdown of the backend architecture for the `WinJobApplier` project. It is designed to help non-coders and future code reviewers easily understand what the code is doing, how it connects to the database, and how the APIs are structured.

---

## 1. How the Backend Connects to the Database (PostgreSQL)

The project connects to a remote PostgreSQL database hosted on Supabase.
1. **Credentials**: The database URL string is stored inside the [`.env`](file:///d:/WinJobApplier/.env) file as `DATABASE_URL`.
2. **Connection Handler**: The database driver module `psycopg2` opens a network pipeline to the PostgreSQL server, executes commands (like `SELECT` to read and `UPDATE` to edit), and returns the records.
3. **Connection Flow**:
   ```mermaid
   graph LR
       main_py[FastAPI: main.py] -->|Calls helpers| database_py[database.py]
       database_py -->|Reads env| env[.env File]
       database_py -->|Opens connection| PostgreSQL[PostgreSQL Database]
   ```

---

## 2. File-by-File Breakdown

### 📄 [db_init.py](file:///d:/WinJobApplier/db_init.py)
* **Purpose**: Runs once on installation to initialize database tables.
* **What it does**: 
  * Checks if the `jobs` (list of listings) and `settings` (user profile parameters) tables exist in PostgreSQL.
  * If they do not exist, it runs the `CREATE TABLE` command to construct them.
  * Inserts a default row (with ID = 1) in the settings table so there's always a settings profile.

### 📄 [backend/database.py](file:///d:/WinJobApplier/backend/database.py)
This file is the **Database Helper Library**. It does not run by itself but contains functions that the main server calls to talk to PostgreSQL.
* **`load_env()`**: Manually loads credentials from `.env` so they are accessible to the program.
* **`get_db_connection()`**: Opens the pipeline connection to the database.
* **`get_settings()`**: Reads your candidate profile details (name, keywords, resume text) from the database.
* **`update_settings(settings_data)`**: Updates your profile parameters (e.g. if you upload a new resume or change keywords).
* **`get_jobs()`**: Fetches all job postings from the database, newest first, to show on the dashboard.
* **`update_job_status(job_id, status)`**: Changes application status (e.g., updates "scraped" to "applied") and marks the timestamp.
* **`run_migrations()`**: Automatically checks and adds the ATS scorecard columns (`ats_score`, `ats_matching`, `ats_missing`, `ats_recommendations`) if they aren't already in the database.
* **`update_job_ats_score(job_id, score, matching, missing, recommendations)`**: Saves calculated match scorecard data to a job listing.

### 📄 [backend/main.py](file:///d:/WinJobApplier/backend/main.py)
This is the **Main Server Engine**. It runs continuously and acts as the gatekeeper, receiving requests from the React frontend web browser and returning database results.
* **`startup_event()`**: Runs on server launch. Calls `database.run_migrations()` to verify your database columns are up-to-date.
* **`extract_text_from_pdf(path)`**: Reads a PDF resume, parses its characters, cleans up spacing split issues, and extracts raw text.
* **`clean_spaced_out_text(text)`**: Helper function that removes weird double-spacing occasionally introduced by PDF parsers.

---

## 3. List of API Endpoints

These are the REST API routes. When the React frontend wants to perform an action, it makes an HTTP request to one of these URLs:

| Method | Endpoint (URL) | Description / What it does | Use Case |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/winjobapplier/settings` | Reads candidate profile details from the database and returns them. | Loads your details on the Profile Settings tab. |
| **POST** | `/api/winjobapplier/settings` | Saves settings input data, parses uploaded PDF text, and writes to database. | When you click "Save Settings". |
| **POST** | `/api/winjobapplier/settings/resume` | Receives PDF upload file, saves it to `uploads/` folder, and extracts its text. | When you upload a resume document. |
| **GET** | `/api/winjobapplier/jobs` | Fetches all job postings in the database. | Renders the listings on the Job Board dashboard. |
| **POST** | `/api/winjobapplier/jobs/{job_id}/status` | Updates the pipeline status (e.g. "Applied") for a specific job entry. | When you change the status dropdown on a card. |
| **POST** | `/api/winjobapplier/scraper/trigger` | Launches the compiled Rust scraper process in the background. | When you click "Trigger Scraper" in advanced options. |
| **POST** | `/api/winjobapplier/jobs/{job_id}/ats-analyze` | Queries the Gemini API with your resume and the job description, calculates the scorecard, saves it, and returns the analysis. | When you click "Analyze Resume Compatibility". |

---

## 4. Google Gemini API Retry Logic (ATS Scorecard)
When `POST /api/winjobapplier/jobs/{job_id}/ats-analyze` is called, the server performs the following:
1. Gathers the job description and your resume text.
2. Formulates a prompt asking the **Gemini-2.5-Flash** AI model to acts as an professional ATS Recruiter.
3. **Connection retry loop**: Because internet hiccups or Google server overloads (503 errors) can happen, the server runs a loop:
   * It attempts to send the request.
   * If Google responds with a temporary error (like 503 Service Unavailable or a timeout), it pauses for a few seconds and **automatically retries** (up to 3 times).
   * Once successful, the response is saved and sent back to the React UI.
