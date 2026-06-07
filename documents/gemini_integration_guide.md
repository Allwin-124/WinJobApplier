# Google Gemini API Integration Guide

This guide explains the Google Gemini API integration used for **ATS Compatibility Scorecard & Keyword Optimizer** calculations in the `WinJobApplier` workspace.

---

## 1. What is Google Gemini API in this Project?
Google's **Gemini-2.5-Flash** API is used as the core AI reasoning engine. 
It analyzes the text content of your uploaded resume against the title and description of a scraped job posting to calculate an overall match percentage score, extract overlapping/missing skills, and give resume-tailoring checklist advice.

---

## 2. How to Get a Gemini API Key
1. Go to **[Google AI Studio](https://aistudio.google.com/)**.
2. Sign in with any Google Account.
3. Click **Get API key** and click **Create API key**.
4. Copy the API key (starts with `AIzaSy...` or `AQ...`).
5. Open your root [`.env`](file:///d:/WinJobApplier/.env) file and add the key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

---

## 3. Where is Gemini Used in the Project?

The backend FastAPI server handles all Gemini communication:

### 📄 [backend/main.py](file:///d:/WinJobApplier/backend/main.py)
* **`analyze_job_ats(job_id)`** (`POST /api/winjobapplier/jobs/{job_id}/ats-analyze`):
  * **Fetch Context**: Loads the user's `resume_text` from the database `settings` table and the `description`, `title`, and `company` from the target job posting.
  * **Build Prompt**: Formulates a detailed ATS recruiter prompt containing instructions, the resume text, and the job description.
  * **Configure JSON Mode**: Sets `generationConfig: { "responseMimeType": "application/json" }` on the Gemini request payload, forcing Gemini to respond with a structured JSON string matching our schema:
    ```json
    {
      "score": <integer between 0 and 100>,
      "matching_keywords": [<list of skills present in both>],
      "missing_keywords": [<list of skills present in job but missing in resume>],
      "recommendations": [<3-5 tailoring tips>]
    }
    ```
  * **Urllib Connection & Retry Loop**:
    Sends an HTTP POST query to Google Generative Language endpoints:
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}`
    * Wraps the connection in an **automatic 3-time retry loop** with backoff to handle temporary `503 Service Unavailable`, `429 Rate Limit`, or network timeout errors.
  * **Update Database**: Stringifies and saves the results in the PostgreSQL `jobs` table, then returns the data.

### 📄 [backend/database.py](file:///d:/WinJobApplier/backend/database.py)
* **`update_job_ats_score(job_id, score, matching, missing, recommendations)`**: Prepares and executes the SQL UPDATE statement to save the calculated compatibility outputs into the job record.
