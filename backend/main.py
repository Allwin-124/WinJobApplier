import os
import shutil
import subprocess
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from typing import Optional
from pypdf import PdfReader

from backend import database

def load_env_file():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    env_path = os.path.join(base_dir, ".env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

load_env_file()

def clean_spaced_out_text(text: str) -> str:
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        parts = [p for p in line.split(' ') if p]
        if not parts:
            cleaned_lines.append("")
            continue
            
        single_char_count = sum(1 for p in parts if len(p) == 1)
        if len(parts) > 2 and (single_char_count / len(parts)) > 0.6:
            words = line.split('  ')
            reconstructed_words = []
            for word in words:
                cleaned_word = word.replace(' ', '')
                if cleaned_word:
                    reconstructed_words.append(cleaned_word)
            cleaned_lines.append(' '.join(reconstructed_words))
        else:
            cleaned_lines.append(line)
    return '\n'.join(cleaned_lines)

def extract_text_from_pdf(path: str) -> str:
    if not path:
        return ""
    if not os.path.isabs(path):
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        path = os.path.join(base_dir, path)
        
    if not os.path.exists(path):
        return ""
        
    try:
        reader = PdfReader(path)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        
        raw_text = text.strip()
        return clean_spaced_out_text(raw_text)
    except Exception as e:
        print(f"Error extracting PDF: {str(e)}")
        return ""

app = FastAPI(title="Win Job Applier Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create and mount the uploads folder to serve resumes statically
uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

class SettingsUpdate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    resume_path: str
    github: str
    portfolio: str
    keywords: str
    country: Optional[str] = "in"
    state: Optional[str] = ""

class JobStatusUpdate(BaseModel):
    status: str    

# --- WinJobApplier Service Endpoints ---

@app.get("/api/winjobapplier/settings")
def get_user_settings():
    """
    Retrieves the user profile settings for the WinJobApplier service.
    """
    settings = database.get_settings()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found. Initialize DB first.")
    return settings

@app.post("/api/winjobapplier/settings")
def update_user_settings(payload: SettingsUpdate):
    """
    Updates the user profile settings for the WinJobApplier service.
    """
    data = payload.dict()
    # If resume_path is provided, extract its text
    if payload.resume_path:
        data["resume_text"] = extract_text_from_pdf(payload.resume_path)
    else:
        data["resume_text"] = ""
        
    updated = database.update_settings(data)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update settings.")
    return {"message": "Settings updated successfully", "settings": updated}

@app.post("/api/winjobapplier/settings/resume")
async def upload_resume(file: UploadFile = File(...)):
    """
    Uploads a resume file from device, saves it to local uploads directory,
    and updates the database resume path.
    """
    if not file.filename.lower().endswith(('.pdf', '.docx', '.doc')):
        raise HTTPException(status_code=400, detail="Only PDF or Word documents are allowed.")
        
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    dest_dir = os.path.join(base_dir, "uploads")
    if not os.path.exists(dest_dir):
        os.makedirs(dest_dir)
        
    file_path = os.path.join(dest_dir, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file to disk: {str(e)}")
        
    db_path = f"uploads/{file.filename}"
    
    # Extract text from the uploaded PDF
    resume_text = ""
    if file.filename.lower().endswith('.pdf'):
        resume_text = extract_text_from_pdf(file_path)
    
    # Retrieve current settings and update the path and extracted text
    current_settings = database.get_settings()
    if not current_settings:
        raise HTTPException(status_code=500, detail="Settings not found. Please initialize DB first.")
        
    current_settings["resume_path"] = db_path
    current_settings["resume_text"] = resume_text
    updated = database.update_settings(current_settings)
    
    return {
        "message": "Resume uploaded successfully",
        "resume_path": db_path,
        "settings": updated
    }

@app.get("/api/winjobapplier/jobs")
def get_all_jobs():
    """
    Retrieves all scraped jobs in the WinJobApplier database.
    """
    return database.get_jobs()

@app.post("/api/winjobapplier/jobs/{job_id}/status")
def update_job_status(job_id: int, payload: JobStatusUpdate):
    """
    Updates the pipeline status of a specific job posting.
    """
    success = database.update_job_status(job_id, payload.status)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update job status.")
    return {"message": f"Job status updated to '{payload.status}'"}

@app.post("/api/winjobapplier/scraper/trigger")
def trigger_scraper():
    """
    Triggers the Rust scraper service to fetch new jobs.
    """
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    executable_path = os.path.join(base_dir, "scraper", "target", "debug", "scraper.exe")

    if not os.path.exists(executable_path):
        raise HTTPException(
            status_code=500,
            detail=f"Scraper executable not found at {executable_path}. Please build it first."
        )

    try:
        result = subprocess.run(
            [executable_path],
            cwd=base_dir,
            capture_output=True,
            text=True,
            check=True,
        )
        return {
            "status": "success",
            "message": "Rust scraper executed successfully.",
            "output": result.stdout.strip()
        }
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Rust scraper execution failed: {e.stderr.strip() if e.stderr else str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while running the scraper: {str(e)}"
        )