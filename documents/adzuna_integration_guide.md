# Adzuna API Integration Guide

This guide explains what the Adzuna API is, how to obtain your credentials, how it is used in the `WinJobApplier` project, and the exact files and logic involved.

---

## 1. What is the Adzuna API?
[Adzuna](https://www.adzuna.com/) is a job search engine that aggregates millions of job listings from thousands of websites. 
In this project, the Adzuna REST API is used as the **primary datasource**. It scans, searches, and crawls active job postings based on your desired country, state/city, and search keywords.

---

## 2. How to Get an Adzuna API Key
1. Go to the **[Adzuna Developer Portal](https://developer.adzuna.com/)**.
2. Sign up or log in to a developer account.
3. Register a new application to generate:
   * **`ADZUNA_APP_ID`**: Public application identifier.
   * **`ADZUNA_APP_KEY`**: Private API access key.
4. Copy these credentials into the root [`.env`](file:///d:/WinJobApplier/.env) file:
   ```env
   ADZUNA_APP_ID=your_adzuna_app_id
   ADZUNA_APP_KEY=your_adzuna_app_key
   ```

---

## 3. Where is Adzuna Used in the Project?

The scraping logic is written in **Rust** inside the `scraper` package:

### 📄 [scraper/src/main.rs](file:///d:/WinJobApplier/scraper/src/main.rs)
* **`load_env()`**: Reads the root `.env` file to fetch `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`.
* **Database Preferences Query**:
  Connects to the Supabase database settings table to load preferences:
  ```sql
  SELECT keywords, country, state, resume_text FROM settings WHERE id = 1;
  ```
* **Sequential URL Generation**:
  Constructs the search query endpoint:
  `https://api.adzuna.com/v1/api/jobs/{country}/search/1?app_id={app_id}&app_key={app_key}&what={search_term}&where={location}&content-type=application/json`
* **JSON Mapping**:
  * **`AdzunaResponse`** and **`AdzunaJob`** structs are used by `serde_json` to map the API response.
  * Extracted job data is stored directly in the `jobs` database table:
    ```sql
    INSERT INTO jobs (guid, title, company, url, description, location, pub_date, status) ...
    ```

---

## 4. How to Download / Install
You do not need to download an SDK for Adzuna. It is queried using standard HTTP REST requests.
* **Rust**: Queried using the `reqwest` crate inside the Rust scraper.
* **Database**: Runs inside the compiled Rust executable which is executed by the FastAPI backend on trigger.
