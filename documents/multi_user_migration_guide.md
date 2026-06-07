# Multi-User SaaS Migration Guide

This guide outlines the technical steps required to migrate `WinJobApplier` from a single-user system (default `id = 1`) to a multi-user SaaS product supporting 100+ active users.

---

## 1. Database Schema Migration

Currently, database constraints restrict the application settings to a single row. We must associate settings and scraped jobs with a specific user account.

### Step A: Update `settings` Table
1. Remove the constraint checking that the setting ID is equal to 1 (`id = 1`).
2. Add a `user_id` column of type `UUID` referencing Supabase's `auth.users(id)` table.
3. Make `user_id` unique so that each user has exactly one settings row.
```sql
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_id_check;
ALTER TABLE settings ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE settings ADD CONSTRAINT settings_user_id_key UNIQUE (user_id);
```

### Step B: Update `jobs` Table
1. Add a `user_id` column of type `UUID` referencing `auth.users(id)`.
2. Modify unique constraints on `url` and `guid` so they are composite unique constraints. This allows different users to scrape/contain the same job postings without key collisions.
```sql
ALTER TABLE jobs ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_url_key;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_guid_key;
ALTER TABLE jobs ADD CONSTRAINT jobs_user_id_url_key UNIQUE (user_id, url);
ALTER TABLE jobs ADD CONSTRAINT jobs_user_id_guid_key UNIQUE (user_id, guid);
```

---

## 2. Frontend Changes (`App.jsx`)

All requests from the browser to the backend must identify the currently logged-in user.

1. Retrieve the active user ID from Supabase auth session:
   `const userId = session?.user?.id;`
2. Pass the user ID as a request header parameter in all fetch API calls (e.g. GET jobs, POST settings, POST analyze):
   ```javascript
   const response = await fetch(`${apiBaseUrl}/api/winjobapplier/jobs`, {
     headers: {
       'Content-Type': 'application/json',
       'X-User-Id': userId
     }
   });
   ```

---

## 3. Backend Changes (`backend/database.py` & `main.py`)

All backend SQL transactions must read the `X-User-Id` header and query the database filtering by the owner's `user_id`.

### Step A: Read Headers in `main.py`
Change backend FastAPI routes to expect the user ID header:
```python
@app.get("/api/winjobapplier/jobs")
def get_all_jobs(x_user_id: str = Header(...)):
    return database.get_jobs(x_user_id)
```

### Step B: Filter SQL Queries in `database.py`
Modify helper functions to execute commands filtered by user ID:
```python
def get_jobs(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM jobs WHERE user_id = %s ORDER BY id DESC;", (user_id,))
    # ...
    
def update_settings(user_id: str, settings_data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE settings
        SET name = %s, email = %s, resume_text = %s, country = %s, state = %s, keywords = %s
        WHERE user_id = %s;
    """, (..., user_id))
    # ...
```

---

## 4. Rust Scraper Executable Updates

The Rust scraper needs to know which user it is active for so it only loads their keywords/settings, and writes jobs associated with their `user_id`.

1. **FastAPI Process Call**: In [main.py](file:///d:/WinJobApplier/backend/main.py), append the user ID as an argument when spawning the scraper subprocess:
   ```python
   subprocess.run([executable_path, "--user-id", x_user_id], ...)
   ```
2. **Rust Arg Parsing**: Update [scraper/src/main.rs](file:///d:/WinJobApplier/scraper/src/main.rs) to read the argument using `std::env::args()`:
   * Load the user settings for that user ID.
   * Include the `user_id` when inserting jobs:
     ```sql
     INSERT INTO jobs (user_id, guid, title, company, url, description, location) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ```
