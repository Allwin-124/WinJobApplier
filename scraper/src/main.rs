use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;

fn get_db_path() -> &'static str {
    // Check if Jobs.db or jobs.db exists in current directory, otherwise look in parent directory
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
    let db_path = get_db_path();
    println!("Connecting to database at: {}", db_path);

    let conn = Connection::open(db_path)?;

    // Retrieve keywords from settings
    let mut stmt = conn.prepare("SELECT keywords FROM settings WHERE id = 1;")?;
    let keywords_str: String = stmt.query_row([], |row| row.get(0)).unwrap_or_default();
    
    // Parse keywords
    let keywords: Vec<String> = keywords_str
        .split(',')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect();

    println!("Loaded keywords filter: {:?}", keywords);

    // Fetch RSS feed
    let url = "https://hnrss.org/jobs";
    println!("Fetching jobs from feed: {}", url);
    
    let client = reqwest::blocking::Client::builder()
        .user_agent("WinJobApplierScraper/1.0")
        .build()?;
        
    let response = client.get(url).send()?;
    let body = response.bytes()?;
    let feed = feed_rs::parser::parse(&body[..])?;

    println!("Scanned {} jobs from feed.", feed.entries.len());

    let mut matched_count = 0;
    let mut inserted_count = 0;

    for entry in feed.entries {
        let title = entry.title.map(|t| t.content).unwrap_or_default();
        let summary = entry.summary.map(|s| s.content).unwrap_or_default();
        let content_text = entry.content.and_then(|c| c.body).unwrap_or_default();
        let description = format!("{}\n{}", summary, content_text);

        let guid = entry.id;
        let url = entry.links.first().map(|l| l.href.clone()).unwrap_or_default();

        if url.is_empty() || title.is_empty() {
            continue;
        }

        // Keyword filter check (case-insensitive)
        let is_match = if keywords.is_empty() {
            true
        } else {
            let search_text = format!("{} {}", title, description).to_lowercase();
            keywords.iter().any(|kw| search_text.contains(kw))
        };

        if is_match {
            matched_count += 1;
            let pub_date = entry.updated.or(entry.published)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default();

            // Extract company from title if format is "Company is hiring Role"
            // Default to "Hacker News" if not parsed
            let company = if let Some(idx) = title.find(" is hiring ") {
                title[..idx].trim().to_string()
            } else if let Some(idx) = title.find(" hiring ") {
                title[..idx].trim().to_string()
            } else {
                "Hacker News".to_string()
            };

            let res = conn.execute(
                "INSERT INTO jobs (guid, title, company, url, description, pub_date, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'scraped');",
                (&guid, &title, &company, &url, &description, &pub_date),
            );

            match res {
                Ok(rows) if rows > 0 => {
                    println!("Inserted Match: \"{}\" by Company: \"{}\"", title, company);
                    inserted_count += 1;
                }
                Ok(_) => {}
                Err(e) => {
                    // Ignore UNIQUE constraint errors (expected for already scraped jobs)
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
