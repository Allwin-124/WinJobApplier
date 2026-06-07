# WinJobApplier: Future Product Roadmap & Features

This document outlines the proposed architecture and integration designs for future enhancements to the WinJobApplier system.

---

## Phase 2: Core Enhancements

### 1. AI-Powered Cover Letter Generator
* **Objective:** Automatically write a tailored cover letter for any matched job description based on the user's resume.
* **Technology:** **Google Gemini API** (Google AI Studio).
* **Storage Cost:** 0 MB local disk space (Cloud-hosted API).
* **Architecture:**
  * Endpoint: `POST /api/winjobapplier/jobs/{job_id}/cover-letter`
  * Action: Reads `resume_text` from settings and `description` from the jobs table, constructs a context-aware prompt, calls the Gemini model, and saves the output to a new `cover_letter` column in `jobs`.

---

## Phase 3: CRM & Automation Scaling

### 2. Job Application Pipeline Tracker
* **Objective:** Move jobs through stages from detection to hiring.
* **Database Updates:**
  * Add pipeline state constraints to the `status` column in the `jobs` table:
    * `scraped` (Newly scraped)
    * `shortlisted` (Saved to check details)
    * `applied` (Application sent)
    * `interviewing` (Interview scheduled)
    * `offered` (Offer received!)
    * `rejected` (Application closed)
  * Add metadata fields: `interview_date` (TIMESTAMP), `offered_at` (TIMESTAMP).
* **UI Features:** Group jobs into dashboard columns or tabs matching their active status.

### 3. SMTP Email Application System
* **Objective:** Apply to jobs with a single click by drafting and sending emails directly from the UI.
* **Technology:** Python `smtplib` and `email` packages.
* **Credentials:** Securely store email configurations (`SMTP_HOST`, `SMTP_PORT`, `SENDER_EMAIL`, `EMAIL_APP_PASSWORD`) in `.env`.
* **Action:** Constructs an email with the generated AI Cover Letter as the body, attaches the uploaded resume PDF from the `uploads/` directory, and transmits it directly to the recruiter's email.

---

## Phase 4: Inbox Automation

### 4. Automated Rejection Email Scanner
* **Objective:** Automatically scan the user's inbox for rejection emails and update job states in the database.
* **Technology:** Python `imaplib` or **Google Gmail API**.
* **Flow:**
  1. Background worker connects to the user's inbox securely.
  2. Scans unread messages for matching rejection keywords (e.g. *"Thank you for your interest, unfortunately..."*).
  3. Parses the email body/sender header using regex or lightweight LLM to extract the **Company Name**.
  4. Queries the Supabase database for jobs with status `applied` matching that company name.
  5. Updates the database status to `rejected` and posts a notification to the dashboard.
