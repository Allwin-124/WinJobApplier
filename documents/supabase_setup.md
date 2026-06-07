# Supabase PostgreSQL Configuration & Connection Guide

This guide explains how to configure and connect to a hosted PostgreSQL database on Supabase from the WinJobApplier application (Python backend and Rust scraper).

---

## 1. Supabase Project Setup
1. Go to [supabase.com](https://supabase.com) and log in.
2. Create a new project named `WinJobApplier`.
3. Set your database password (e.g. `appuchu#203010`) and write it down.
4. Select the region closest to you (e.g., Tokyo `ap-northeast-1`).
5. Choose the **Free Tier** and click **Create Project**.

---

## 2. Choosing Connection Method (Direct vs. Connection Pooler)

Supabase provides two connection methods. Due to IPv6 networking limitations on local home networks, the application requires the **Connection Pooler** (Supavisor) rather than the direct database connection.

| Parameter | Direct Connection | Connection Pooler (Recommended) |
| :--- | :--- | :--- |
| **Host** | `db.[PROJECT_ID].supabase.co` | `aws-1-[REGION].pooler.supabase.com` |
| **Port** | `5432` | `6543` (Transaction mode) / `5432` (Session mode) |
| **Username** | `postgres` | `postgres.[PROJECT_ID]` |
| **Protocol** | IPv6-only | IPv4 and IPv6 compatible |

---

## 3. Retrieving your Connection String
1. Click the green **"Connect"** button in the header of the Supabase dashboard.
2. Select the **ORM** tab (Prisma or Drizzle).
3. Copy the URL generated under **Configure ORM**.
4. The host prefix is usually `aws-1-[region]` or `aws-0-[region]` depending on your cluster. For example:
   `postgresql://postgres.krmoydaseyqggiriwwfl:[YOUR-PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres`

---

## 4. Configuring the `.env` File
Create or update a `.env` file in the root of the project (`D:\WinJobApplier\.env`):

```text
DATABASE_URL="postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-1-[REGION].pooler.supabase.com:6543/postgres?sslmode=require"
```

### ⚠️ Special Characters Password Encoding
If your database password contains special characters (like `#`, `@`, `:`, `$`), they must be **URL-encoded** (percent-encoded) in the connection string to prevent URL parsing errors.

* `#` ➜ `%23`
* `@` ➜ `%40`
* `:` ➜ `%3A`
* `$` ➜ `%24`

**Example:**
If your password is `appuchu#203010`, the connection string should write it as:
`...postgres.krmoydaseyqggiriwwfl:appuchu%23203010@aws-1...`

---

## 5. Running Database Operations
Once the `.env` file is set up, run the initialization command from the terminal to create PostgreSQL tables:

```powershell
.\.venv\Scripts\python db_init.py
```
