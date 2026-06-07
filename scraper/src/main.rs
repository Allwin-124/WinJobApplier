use anyhow::Result;
use postgres::{Client, Row};
use postgres_native_tls::MakeTlsConnector;
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

fn load_env() {
    // Look for .env in current directory, or in parent directory
    let env_paths = vec![".env", "../.env"];
    for path in env_paths {
        if let Ok(content) = std::fs::read_to_string(path) {
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                if let Some((key, value)) = line.split_once('=') {
                    let key = key.trim();
                    let value = value.trim().trim_matches('"').trim_matches('\'');
                    std::env::set_var(key, value);
                }
            }
            break; // Stop after first successful .env load
        }
    }
}

fn connect_db() -> Result<Client> {
    let db_url = std::env::var("DATABASE_URL")
        .map_err(|_| anyhow::anyhow!("DATABASE_URL environment variable is not set in environment or .env file"))?;
        
    // Build TLS connector that accepts untrusted certificate chains to bypass Windows trust store issues
    let connector = native_tls::TlsConnector::builder()
        .danger_accept_invalid_certs(true)
        .build()?;
    let connector = MakeTlsConnector::new(connector);
    
    let client = Client::connect(&db_url, connector)?;
    Ok(client)
}

fn main() -> Result<()> {
    // 1. Fetch environment variables
    load_env();
    let app_id = std::env::var("ADZUNA_APP_ID").unwrap_or_default();
    let app_key = std::env::var("ADZUNA_APP_KEY").unwrap_or_default();

    if app_id.is_empty() || app_key.is_empty() {
        anyhow::bail!("Missing ADZUNA_APP_ID or ADZUNA_APP_KEY. Please verify your .env file in the project root.");
    }

    // 2. Open PostgreSQL Connection
    println!("Connecting to PostgreSQL database...");
    let mut conn = connect_db()?;

    // 3. Retrieve keywords, preferences and resume_text from settings
    let rows = conn.query("SELECT keywords, country, state, resume_text FROM settings WHERE id = 1;", &[])?;
    let (keywords_str, country, state, resume_text) = if !rows.is_empty() {
        let row = &rows[0];
        let kw: String = row.get("keywords");
        let c: String = row.get("country");
        let s: String = row.get("state");
        let r_opt: Option<String> = row.get("resume_text");
        (kw, c, s, r_opt.unwrap_or_default())
    } else {
        ("".to_string(), "in".to_string(), "".to_string(), "".to_string())
    };

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

    // 5. Parse state/city into multiple locations
    let mut locations: Vec<String> = state
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if locations.is_empty() {
        locations.push("".to_string());
    }

    println!("Target locations for search: {:?}", locations);

    let client = reqwest::blocking::Client::builder()
        .user_agent("WinJobApplierScraper/1.0")
        .danger_accept_invalid_certs(true)
        .build()?;

    let search_term = keywords.first().cloned().unwrap_or_else(|| "developer".to_string());
    
    let mut matched_count = 0;
    let mut inserted_count = 0;

    // 6. Query Adzuna API sequentially for each location
    for location in &locations {
        println!("--- Scraping Location: '{}' ---", location);
        let url = format!(
            "https://api.adzuna.com/v1/api/jobs/{}/search/1?app_id={}&app_key={}&what={}&where={}&content-type=application/json",
            country.trim().to_lowercase(),
            app_id,
            app_key,
            urlencoding::encode(&search_term),
            urlencoding::encode(location)
        );

        let response = client.get(&url).send()?;
        if !response.status().is_success() {
            eprintln!("Warning: Adzuna API request failed for location '{}' with status: {}.", location, response.status());
            continue;
        }

        let body = response.text()?;
        let data: AdzunaResponse = match serde_json::from_str(&body) {
            Ok(res) => res,
            Err(e) => {
                eprintln!("Warning: Failed to parse JSON for location '{}': {}", location, e);
                continue;
            }
        };

        println!("Scanned {} jobs from Adzuna for location '{}'.", data.results.len(), location);

        for job in data.results {
            let company = job.company.and_then(|c| c.display_name).unwrap_or_else(|| "Unknown".to_string());
            let loc_name = job.location.and_then(|l| l.display_name).unwrap_or_else(|| "".to_string());
            let guid = job.id.to_string();

            // Calculate word overlap with resume
            let job_words: HashSet<String> = format!("{} {}", job.title, job.description)
                .split(|c: char| !c.is_alphanumeric())
                .map(|s| s.trim().to_lowercase())
                .filter(|s| s.len() >= 3)
                .collect();

            let resume_overlap_count = resume_words.iter().filter(|w| job_words.contains(*w)).count();

            // Match criteria:
            let matches_keywords = !keywords.is_empty() && {
                let search_text = format!("{} {}", job.title, job.description).to_lowercase();
                keywords.iter().any(|kw| search_text.contains(kw))
            };

            let matches_resume = !resume_words.is_empty() && resume_overlap_count >= 6;

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
                    "INSERT INTO jobs (guid, title, company, url, description, pub_date, location, status) \
                     VALUES ($1, $2, $3, $4, $5, $6, $7, 'scraped') \
                     ON CONFLICT (guid) DO NOTHING;",
                    &[&guid, &job.title, &company, &job.redirect_url, &job.description, &job.created, &loc_name],
                );

                match res {
                    Ok(rows) if rows > 0 => {
                        println!("Inserted Match: \"{}\" by Company: \"{}\" in {}", job.title, company, loc_name);
                        inserted_count += 1;
                    }
                    Ok(_) => {}
                    Err(e) => {
                        eprintln!("Error inserting job: {}", e);
                    }
                }
            }
        }
        
        // Brief sleep to avoid hitting API rate limits
        std::thread::sleep(std::time::Duration::from_millis(500));
    }

    println!("Scraping Summary: Matched: {}, Newly inserted: {}", matched_count, inserted_count);
    Ok(())
}
