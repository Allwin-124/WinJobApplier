import psycopg2
import os

# Function to load .env manually
def load_env():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, ".env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    val = val.strip().strip('"').strip("'")
                    os.environ[key.strip()] = val

def initialize_database():
    load_env()
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not found in environment or .env file.")
        return

    print("Connecting to PostgreSQL database...")
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        print("Creating 'jobs' table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id SERIAL PRIMARY KEY,
            guid TEXT UNIQUE, 
            title TEXT NOT NULL,
            company TEXT NOT NULL,
            url TEXT UNIQUE NOT NULL,
            description TEXT,
            pub_date TEXT,
            status TEXT NOT NULL DEFAULT 'scraped',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            applied_at TIMESTAMP,
            location TEXT,
            ats_score INTEGER,
            ats_matching TEXT,
            ats_missing TEXT,
            ats_recommendations TEXT
        );
        """)

        print("Creating 'settings' table...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1) DEFAULT 1,
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

        print("Inserting default settings row if it doesn't exist...")
        cursor.execute("""
        INSERT INTO settings (id, name, email, phone, resume_path, linkedin, github, portfolio, keywords, resume_text, country, state)
        VALUES (1, '', '', '', '', '', '', '', '', '', 'in', '')
        ON CONFLICT (id) DO NOTHING;
        """)

        conn.commit()
        cursor.close()
        conn.close()
        print("Database initialization is ready in PostgreSQL.")
    except Exception as e:
        print(f"Error initializing database: {str(e)}")

if __name__ == "__main__":
    initialize_database()
