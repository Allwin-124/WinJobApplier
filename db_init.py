import sqlite3
import os 

# Defining Db Name
DB_NAME = "Jobs.db"

def get_db_path():

#Get the absolute path to the database file in the same directory as the script 
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(script_dir, DB_NAME)

def initialize_database():
    db_path =get_db_path()
    print(f"Connecting to database at:{db_path}...")

    conn =sqlite3.connect(db_path)
    cursor =conn.cursor()

#  Connect to the SQLite database creates 'jobs.db' if it doesn't exist   


    cursor.execute("PRAGMA foreign_key = ON")

    print("Creating 'jobs' table ...")

    cursor.execute(""" CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guid  TEXT UNIQUE, 
        --Prevents duplicate insertions from Rss
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        url TEXT UNIQUE NOT NULL,
        description TEXT,
        pub_date TEXT,
        status TEXT NOT NULL DEFAULT 'scraped',
        created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,
        applied_at TIMESTAMP,
        location TEXT
        )
            """)

# Create the 'settings' table to store your profile settings
    print("Creating 'settings' table...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1) DEFAULT 1, -- Constraints table to a single row
        name TEXT,
        email TEXT,
        phone TEXT,
        resume_path TEXT,
        linkedin TEXT,
        github TEXT,
        portfolio TEXT,
        keywords TEXT,
        resume_text TEXT,
        country TEXT DEFAULT 'in',
        state TEXT DEFAULT '',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

# Insert a default row of empty settings if it doesn't exist
    cursor.execute("""
    INSERT OR IGNORE INTO settings (id, name, email, phone, resume_path, linkedin, github, portfolio, keywords, resume_text, country, state)
    VALUES (1, '', '', '', '', '', '', '', '', '', 'in', '');
    """)

    conn.commit()
    conn.close()
    print("Database initialization is ready.")    


if __name__ == "__main__":
    initialize_database()


    
            


