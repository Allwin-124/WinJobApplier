# Project Commands Cheat Sheet

This document lists all the terminal commands used to build, run, configure, and maintain the `WinJobApplier` workspace.

---

## 1. Database Setup & Migrations
Before running the project, you must set up the database tables. Run this from the root `WinJobApplier` folder:

* **Initialize/Create Database Tables**:
  ```powershell
  .\.venv\Scripts\python db_init.py
  ```

---

## 2. Running the FastAPI Backend Server
The backend Python server must run continuously to process API requests. Run this from the root `WinJobApplier` folder:

* **Start Backend Server (Development Mode with Auto-Reload)**:
  ```powershell
  .\.venv\Scripts\python -m uvicorn backend.main:app --reload
  ```

---

## 3. Running & Building the React Frontend
All frontend operations should be executed from the **`frontend/`** subdirectory:

* **Navigate to Frontend Directory**:
  ```powershell
  cd .\frontend\
  ```

* **Start React Frontend Development Server**:
  ```powershell
  npm run dev
  ```
  *(Opens the dashboard locally at http://localhost:5173)*

* **Build Frontend for Production**:
  ```powershell
  npm run build
  ```
  *(Compiles and creates static HTML/CSS/JS bundles inside `frontend/dist/`)*

---

## 4. Building & Running the Rust Scraper
The job scraper is written in Rust. You must compile the binary so the FastAPI backend can trigger it.

* **Navigate to Scraper Directory**:
  ```powershell
  cd .\scraper\
  ```

* **Compile Scraper in Release Mode (Fastest execution)**:
  ```powershell
  cargo build --release
  ```
  *(Generates executable binary file at `scraper/target/release/scraper.exe`)*

* **Compile Scraper in Debug Mode (Faster compilation for testing)**:
  ```powershell
  cargo build
  ```
  *(Generates executable binary file at `scraper/target/debug/scraper.exe`)*

* **Run Scraper manually from Terminal**:
  ```powershell
  cargo run --release
  ```

---

## 5. Git Commands Cheat Sheet
Run these commands from the root `WinJobApplier` directory to save and upload your changes to GitHub:

* **Check current status (modified/added files)**:
  ```powershell
  git status
  ```

* **Stage all modified and new files**:
  ```powershell
  git add .
  ```

* **Commit with a descriptive message**:
  ```powershell
  git commit -m "Your description here"
  ```

* **Push local commits to GitHub repository**:
  ```powershell
  git push
  ```
