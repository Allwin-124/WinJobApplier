# WinJobApplier Resume Matching Code Changes

This document details all the changes made across the project to implement job matching based on both search keywords and parsed PDF resume text.

---

## 1. Database Schema Changes

### File: [db_init.py](file:///D:/WinJobApplier/db_init.py)
**Change Description:** Added the `resume_text` column to the `settings` table to cache the parsed resume text content, and updated the default settings row insertion.

```diff
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
+        resume_text TEXT,  -- Cached PDF text
         country TEXT DEFAULT 'in',
         state TEXT DEFAULT '',
         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     );
     """)

 # Insert a default row of empty settings if it doesn't exist
     cursor.execute("""
-    INSERT OR IGNORE INTO settings (id, name, email, phone, resume_path, linkedin, github, portfolio, keywords, country, state)
-    VALUES (1, '', '', '', '', '', '', '', '', 'in', '');
+    INSERT OR IGNORE INTO settings (id, name, email, phone, resume_path, linkedin, github, portfolio, keywords, resume_text, country, state)
+    VALUES (1, '', '', '', '', '', '', '', '', '', 'in', '');
     """)
```

---

## 2. Database Layer Changes

### File: [backend/database.py](file:///D:/WinJobApplier/backend/database.py)
**Change Description:** Updated the `update_settings` function to receive and write `resume_text` into the SQLite database.

```diff
         UPDATE settings
         SET name = ?, email = ?, phone = ?, resume_path = ?, 
             linkedin = ?, github = ?, portfolio = ?, keywords = ?,
-            country = ?, state = ?,
+            resume_text = ?, country = ?, state = ?,
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
+        settings_data.get("resume_text", ""),
         settings_data.get("country", "in"),
         settings_data.get("state", "")
     ))
```

---

## 3. Python API Changes

### File: [backend/main.py](file:///D:/WinJobApplier/backend/main.py)
**Change Description:** 
- Added a `clean_spaced_out_text` utility to fix spacing issues from `pypdf` extraction (e.g. `"s o f t w a r e"` -> `"software"`).
- Integrated `pypdf` in `extract_text_from_pdf` to extract clean text from the PDF.
- Updated `update_user_settings` and `upload_resume` to extract and cache the resume text automatically upon settings save or file upload.

**Helper Code Added:**
```python
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
```

**Endpoint Updates Diff:**
```diff
 @app.post("/api/winjobapplier/settings")
 def update_user_settings(payload: SettingsUpdate):
-    updated = database.update_settings(payload.dict())
+    data = payload.dict()
+    if payload.resume_path:
+        data["resume_text"] = extract_text_from_pdf(payload.resume_path)
+    else:
+        data["resume_text"] = ""
+    updated = database.update_settings(data)
```

---

## 4. Rust Scraper Changes

### File: [scraper/src/main.rs](file:///D:/WinJobApplier/scraper/src/main.rs)
**Change Description:**
- Updated the database select query to retrieve `resume_text` alongside keywords and preferences.
- Built a list of stop words to filter out standard English filler words.
- Tokenized the parsed resume text into a set of unique skill terms.
- Implemented a keyword overlap algorithm to calculate the intersection between the job posting and your resume words.
- Setup matching rule: A job matches if it hits any primary keyword OR has an overlap of 6+ distinct words with your resume.

**SQL & Parsing Logic Diff:**
```diff
-    // 3. Retrieve keywords and preferences from settings
-    let mut stmt = conn.prepare("SELECT keywords, country, state FROM settings WHERE id = 1;")?;
-    let (keywords_str, country, state): (String, String, String) = stmt.query_row([], |row| {
-        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
-    }).unwrap_or_else(|_| ("".to_string(), "in".to_string(), "".to_string()));
+    // 3. Retrieve keywords, preferences and resume_text from settings
+    let mut stmt = conn.prepare("SELECT keywords, country, state, resume_text FROM settings WHERE id = 1;")?;
+    let (keywords_str, country, state, resume_text_opt): (String, String, String, Option<String>) = stmt.query_row([], |row| {
+        Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
+    }).unwrap_or_else(|_| ("".to_string(), "in".to_string(), "".to_string(), None));
+    let resume_text = resume_text_opt.unwrap_or_default();
```

**Word Overlap & Filtering Matching Logic Diff:**
```diff
+        // Calculate word overlap with resume
+        let job_words: HashSet<String> = format!("{} {}", job.title, job.description)
+            .split(|c: char| !c.is_alphanumeric())
+            .map(|s| s.trim().to_lowercase())
+            .filter(|s| s.len() >= 3)
+            .collect();
+
+        let resume_overlap_count = resume_words.iter().filter(|w| job_words.contains(*w)).count();
+
+        let matches_keywords = !keywords.is_empty() && {
+            let search_text = format!("{} {}", job.title, job.description).to_lowercase();
+            keywords.iter().any(|kw| search_text.contains(kw))
+        };
+
+        let matches_resume = !resume_words.is_empty() && resume_overlap_count >= 6;
+
+        let is_match = if keywords.is_empty() && resume_words.is_empty() {
+            true
+        } else {
+            matches_keywords || matches_resume
+        };
+
         if is_match {
             matched_count += 1;
+            if matches_resume {
+                println!("Resume Match ({} words overlap): \"{}\" by Company: \"{}\"", resume_overlap_count, job.title, company);
+            } else {
+                println!("Keyword Match: \"{}\" by Company: \"{}\"", job.title, company);
+            }
```
