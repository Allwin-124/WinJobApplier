# WinJobApplier Code Changes: SQLite to PostgreSQL Migration

This document details all codebase modifications performed during the migration from the local SQLite database (`Jobs.db`) to the hosted PostgreSQL database on Supabase.

---

## 1. Python Database Interface (`backend/database.py`)
* **Before:** Connected to a local SQLite database (`jobs.db`) using the built-in `sqlite3` library. SQL queries used `?` placeholders.
* **After:** Replaced `sqlite3` with `psycopg2` (using `RealDictCursor` for dictionary-style row mappings). SQL queries were modified to use PostgreSQL dialect placeholders (`%s`).
* **Key functions updated:**
  * `get_db_connection()`: Manually parses the `.env` file to retrieve `DATABASE_URL` and establishes a secure connection.
  * `get_settings()` / `update_settings()`: Standardized to PostgreSQL queries.
  * `get_jobs()` / `update_job_status()`: Swapped placeholders to `%s`.

---

## 2. API Backend Controller (`backend/main.py`)
* **Before:** The scraper trigger endpoint was hardcoded to look for `scraper.exe` only in the debug target location of a Windows environment.
* **After:** Updated the trigger endpoint to support cross-platform candidate paths, checking release/debug modes and Linux/Windows file extensions:
  1. `/app/scraper/target/release/scraper` (Docker/Linux release)
  2. `/app/scraper/target/debug/scraper` (Docker/Linux debug)
  3. `scraper/target/release/scraper.exe` (Windows release)
  4. `scraper/target/debug/scraper.exe` (Windows debug)

---

## 3. Database Initialization Script (`db_init.py`)
* **Before:** Initialized an SQLite schema using auto-increment fields and `INSERT OR IGNORE` clauses.
* **After:**
  * Swapped database engine to `psycopg2` connecting over the web.
  * Translated tables to PostgreSQL dialect:
    * `INTEGER PRIMARY KEY AUTOINCREMENT` ➜ `SERIAL PRIMARY KEY`.
    * Added unique constraints on `guid` and `url`.
    * Swapped SQLite `INSERT OR IGNORE` with PostgreSQL `ON CONFLICT (id) DO NOTHING` for default settings insertion.

---

## 4. Dependencies (`requirements.txt` & `.env`)
* **requirements.txt:** Added `psycopg2-binary>=2.9.0` and `pypdf>=4.0.0` to support remote PostgreSQL calls and resume PDF parsing.
* **.env:** Swapped local path values for a single unified `DATABASE_URL` connection string.

---

## 5. Rust Scraper (`scraper/Cargo.toml` & `scraper/src/main.rs`)
* **Cargo.toml:** Swapped the SQLite driver `rusqlite` for the robust `postgres` (with `with-serde_json-1` feature), `native-tls` and `postgres-native-tls` crates for secure SSL communication.
* **main.rs:**
  * Swapped `rusqlite::Connection` to `postgres::Client`.
  * Added a `load_env()` utility to load the `.env` configuration file manually (avoiding bloating compile times with extra crate dependencies).
  * Added TLS connector initialization using `MakeTlsConnector`.
  * Rewrote SQL query syntax:
    * `?1`, `?2` parameters were converted to PostgreSQL `$1`, `$2` placeholders.
    * Database insertion queries use `ON CONFLICT (guid) DO NOTHING` for idempotency.
