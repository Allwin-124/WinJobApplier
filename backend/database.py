import sqlite3
import os

# Resolve path to app.db (which is located in the parent directory of backend)
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "jobs.db"))

def get_db_connection():
    """
    Establishes a connection to the SQLite database.
    Configures it to return Row objects, which act like dictionaries.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_settings():
    """
    Fetches the single row of settings from the database.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM settings WHERE id = 1;")
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_settings(settings_data: dict):
    """
    Updates the single settings row with new values.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE settings
        SET name = ?, email = ?, phone = ?, resume_path = ?, 
            linkedin = ?, github = ?, portfolio = ?, keywords = ?,
            resume_text = ?, country = ?, state = ?,
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
    conn.close()
    return get_settings()

def get_jobs():
    """
    Fetches all jobs from the database, sorted newest first.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs ORDER BY id DESC;")
    rows = cursor.fetchall()
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
            SET status = ?, applied_at = CURRENT_TIMESTAMP 
            WHERE id = ?;
        """, (status, job_id))
    else:
        cursor.execute("""
            UPDATE jobs 
            SET status = ?, applied_at = NULL 
            WHERE id = ?;
        """, (status, job_id))
        
    conn.commit()
    conn.close()
    return True
