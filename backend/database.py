import os
import psycopg2
from psycopg2.extras import RealDictCursor

def load_env():
    """
    Manually load environmental variables from the root .env file.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.abspath(os.path.join(script_dir, "..", ".env"))
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    val = val.strip().strip('"').strip("'")
                    os.environ[key.strip()] = val

def get_db_connection():
    """
    Establishes a connection to the PostgreSQL database on Supabase.
    """
    load_env()
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not found in environment or .env file.")
    conn = psycopg2.connect(db_url)
    return conn

def get_settings():
    """
    Fetches the single row of settings from the database.
    """
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM settings WHERE id = 1;")
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return dict(row) if row else None

def update_settings(settings_data: dict):
    """
    Updates the single settings row with new values.
    """
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        UPDATE settings
        SET name = %s, email = %s, phone = %s, resume_path = %s, 
            linkedin = %s, github = %s, portfolio = %s, keywords = %s,
            resume_text = %s, country = %s, state = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1;
    """, (
        settings_data.get("name", ""),
        settings_data.get("email", ""),
        settings_data.get("phone", ""),
        settings_data.get("resume_path", ""),
        settings_data.get("linkedin", ""),
        settings_data.get("github", ""),
        settings_data.get("portfolio", ""),
        settings_data.get("keywords", ""),
        settings_data.get("resume_text", ""),
        settings_data.get("country", "in"),
        settings_data.get("state", "")
    ))
    conn.commit()
    cursor.close()
    conn.close()
    return get_settings()

def get_jobs():
    """
    Fetches all jobs from the database, sorted newest first.
    """
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM jobs ORDER BY id DESC;")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [dict(row) for row in rows]

def update_job_status(job_id: int, status: str):
    """
    Updates the application status of a specific job by its ID.
    If the status is set to 'applied', it records the applied_at timestamp.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if status == "applied":
        cursor.execute("""
            UPDATE jobs 
            SET status = %s, applied_at = CURRENT_TIMESTAMP 
            WHERE id = %s;
        """, (status, job_id))
    else:
        cursor.execute("""
            UPDATE jobs 
            SET status = %s, applied_at = NULL 
            WHERE id = %s;
        """, (status, job_id))
        
    conn.commit()
    cursor.close()
    conn.close()
    return True

def run_migrations():
    """
    Dynamically adds ATS scorecard tracking columns to the jobs table if they do not exist.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ats_score INTEGER;")
    cursor.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ats_matching TEXT;")
    cursor.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ats_missing TEXT;")
    cursor.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ats_recommendations TEXT;")
    conn.commit()
    cursor.close()
    conn.close()
    print("Database migrations applied successfully.")

def update_job_ats_score(job_id: int, score: int, matching: str, missing: str, recommendations: str):
    """
    Saves the ATS scorecard results for a specific job entry.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE jobs
        SET ats_score = %s, ats_matching = %s, ats_missing = %s, ats_recommendations = %s
        WHERE id = %s;
    """, (score, matching, missing, recommendations, job_id))
    conn.commit()
    cursor.close()
    conn.close()
    return True
