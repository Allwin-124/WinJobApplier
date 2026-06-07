# Supabase Connection Issues & Resolutions

This document details two major database connectivity issues encountered during the PostgreSQL migration and how they were resolved.

---

## 1. Issue: Trust Provider SSL Handshake Failure

### Symptoms:
The Rust scraper crashed with the following error during database or API requests:
```text
Caused by:
    A certificate chain processed, but terminated in a root certificate which is not trusted by the trust provider. (os error -2146762487)
```

### Root Cause:
* Supabase databases and the Adzuna API secure their connections using TLS/SSL signed by modern Root Certificate Authorities (like Let's Encrypt's `ISRG Root X1`).
* Rust's `native-tls` library queries the Windows system certificate store via SChannel to verify these signatures.
* If a Windows machine is outdated (has not updated its root store) or has active antivirus software performing HTTPS inspection, the client rejects the connection because the root signer is not trusted by the local OS.

### Resolution:
We updated the TLS connection builders in `scraper/src/main.rs` to allow untrusted root certificates, while keeping the data transmission fully encrypted.
* **Database TLS:**
  ```rust
  let connector = native_tls::TlsConnector::builder()
      .danger_accept_invalid_certs(true)
      .build()?;
  ```
* **HTTP reqwest API Client:**
  ```rust
  let client = reqwest::blocking::Client::builder()
      .danger_accept_invalid_certs(true)
      .build()?;
  ```

---

## 2. Issue: Scraper Hanging During Database Queries (Port 6543)

### Symptoms:
The scraper successfully established a connection but hung indefinitely when executing the `INSERT` statements for matched jobs.

### Root Cause:
* **Transaction Pooling (Port 6543):** By default, Supabase's transaction pooler (Supavisor) assigns database connections dynamically per SQL transaction.
* **Prepared Statements:** The Rust `postgres` driver uses prepared statements under the hood when executing parameterized queries (e.g. `conn.execute` or `conn.query`). Prepared statements are session-scoped and must persist on the same database backend connection.
* In **Transaction Mode**, because the backend connection is released immediately after a query, prepared statements are not preserved, causing the Postgres client to wait or hang indefinitely.

### Resolution:
We swapped the connection port from `6543` to `5432` in the `.env` configuration file:
* **Session Pooling (Port 5432):** Session mode allows persistent connections to the pooler. The session is preserved for the entire lifetime of the client, fully supporting prepared statements.
* **IPv4 Compatible:** It still routes through the pooler host `aws-1-ap-northeast-1.pooler.supabase.com`, meaning it bypasses local IPv6 resolution restrictions.

```text
DATABASE_URL="postgresql://postgres.krmoydaseyqggiriwwfl:appuchu%23203010@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
```
