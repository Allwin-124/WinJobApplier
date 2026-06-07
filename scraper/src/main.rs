use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;
use serde::Deserialize;
use std::collections::HashSet;

#[derive(Deserialize, Debug)]
struct AdzunaResponse {
    results: Vec<AdzunaJob>,
}

#[derive(Deserialize, Debug)]
struct AdzunaJob {
    id: serde_json::Value,
    title: String,
    company: Option<AdzunaCompany>,
    description: String,
    redirect_url: String,
    created: String,
    location: Option<AdzunaLocation>,
}

#[derive(Deserialize, Debug)]
struct AdzunaCompany {
    display_name: Option<String>,
}

#[derive(Deserialize, Debug)]
struct AdzunaLocation {
    display_name: Option<String>,
}

fn get_db_path() -> &'static str {
    if Path::new("Jobs.db").exists() {
        "Jobs.db"
    } else if Path::new("jobs.db").exists() {
        "jobs.db"
    } else if Path::new("../Jobs.db").exists() {
        "../Jobs.db"
    } else {
        "../jobs.db"
    }
}

fn main() -> Result<()> {
    // 1. Fetch environment variables
    let app_id = std::env::var("ADZUNA_APP_ID").unwrap_or_default();
    let app_key = std::env::var("ADZUNA_APP_KEY").unwrap_or_default();

    if app_id.is_empty() || app_key.is_empty() {
        anyhow::bail!("Missing ADZUNA_APP_ID or ADZUNA_APP_KEY. Please verify your .env file in the project root.");
    }

    // 2. Open DB Connection
    let db_path = get_db_path();
    println!("Connecting to database at: {}", db_path);
    let conn = Connection::open(db_path)?;

    // 3. Retrieve keywords, preferences and resume_text from settings
    let mut stmt = conn.prepare("SELECT keywords, country, state, resume_text FROM settings WHERE id = 1;")?;
    let (keywords_str, country, state, resume_text_opt): (String, String, String, Option<String>) = stmt.query_row([], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    }).unwrap_or_else(|_| ("".to_string(), "in".to_string(), "".to_string(), None));
    let resume_text = resume_text_opt.unwrap_or_default();

    // 4. Parse Keywords
    let keywords: Vec<String> = keywords_str
        .split(',')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect();

    // Extract distinct words from resume (excluding common stop words)
    let stop_words: HashSet<&str> = [
        "and", "the", "for", "with", "from", "that", "this", "your", "will", "our", "are", 
        "have", "about", "their", "into", "over", "other", "some", "them", "these", "would",
        "work", "skills", "experience", "role", "team", "business", "client", "support", "development",
        "management", "project", "systems", "processes", "tools", "years", "working"
    ].iter().cloned().collect();

    let resume_words: HashSet<String> = resume_text
        .split(|c: char| !c.is_alphanumeric())
        .map(|s| s.trim().to_lowercase())
        .filter(|s| s.len() >= 3 && !stop_words.contains(s.as_str()))
        .collect();

    println!("Loaded preferences: Country: '{}', State/City: '{}', Keywords: {:?}", country, state, keywords);
    println!("Parsed {} unique skill words from your PDF resume.", resume_words.len());

    // 5. Query Adzuna India / Regional API
    let search_term = keywords.first().cloned().unwrap_or_else(|| "developer".to_string());
    let url = format!(
        "https://api.adzuna.com/v1/api/jobs/{}/search/1?app_id={}&app_key={}&what={}&where={}&content-type=application/json",
        country.trim().to_lowercase(),
        app_id,
        app_key,
        urlencoding::encode(&search_term),
        urlencoding::encode(&state)
    );

    println!("Querying Adzuna API search endpoint...");
    
    let client = reqwest::blocking::Client::builder()
        .user_agent("WinJobApplierScraper/1.0")
        .build()?;
        
    let response = client.get(&url).send()?;
    if !response.status().is_success() {
        anyhow::bail!(
            "Adzuna API request failed with status: {}. Please check your credentials in .env.", 
            response.status()
        );
    }

    let body = response.text()?;
    let data: AdzunaResponse = serde_json::from_str(&body)?;

    println!("API response received. Scanned {} jobs from Adzuna.", data.results.len());

    let mut matched_count = 0;
    let mut inserted_count = 0;

    // 6. Iterate and insert matches
    for job in data.results {
        let company = job.company.and_then(|c| c.display_name).unwrap_or_else(|| "Unknown".to_string());
        let location = job.location.and_then(|l| l.display_name).unwrap_or_else(|| "".to_string());
        let guid = job.id.to_string();

        // Calculate word overlap with resume
        let job_words: HashSet<String> = format!("{} {}", job.title, job.description)
            .split(|c: char| !c.is_alphanumeric())
            .map(|s| s.trim().to_lowercase())
            .filter(|s| s.len() >= 3)
            .collect();

        let resume_overlap_count = resume_words.iter().filter(|w| job_words.contains(*w)).count();

        // Match criteria:
        // 1. If keywords are specified: matches if job text contains any primary keyword.
        // 2. OR if resume is populated: matches if at least 6 distinct words from the resume overlap with the job posting.
        let matches_keywords = !keywords.is_empty() && {
            let search_text = format!("{} {}", job.title, job.description).to_lowercase();
            keywords.iter().any(|kw| search_text.contains(kw))
        };

        let matches_resume = !resume_words.is_empty() && resume_overlap_count >= 6;

        // If no keywords are specified and resume is empty, match all jobs. Otherwise check match conditions.
        let is_match = if keywords.is_empty() && resume_words.is_empty() {
            true
        } else {
            matches_keywords || matches_resume
        };

        if is_match {
            matched_count += 1;
            if matches_resume {
                println!("Resume Match ({} words overlap): \"{}\" by Company: \"{}\"", resume_overlap_count, job.title, company);
            } else {
                println!("Keyword Match: \"{}\" by Company: \"{}\"", job.title, company);
            }

            let res = conn.execute(
                "INSERT INTO jobs (guid, title, company, url, description, pub_date, location, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'scraped');",
                (&guid, &job.title, &company, &job.redirect_url, &job.description, &job.created, &location),
            );

            match res {
                Ok(rows) if rows > 0 => {
                    println!("Inserted Match: \"{}\" by Company: \"{}\" in {}", job.title, company, location);
                    inserted_count += 1;
                }
                Ok(_) => {}
                Err(e) => {
                    if !e.to_string().contains("UNIQUE constraint failed") {
                        eprintln!("Error inserting job: {}", e);
                    }
                }
            }
        }
    }

    println!("Scraping Summary: Matched: {}, Newly inserted: {}", matched_count, inserted_count);
    Ok(())
}
