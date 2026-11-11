# Rewardly — AI-Powered Employee Performance, Loyalty & Reward Recognition System

Rewardly unifies **sales performance, attendance, customer feedback, peer/manager recognition, and AI insights** for Indian textile showrooms and retail teams into a single Node.js + React + Supabase platform.

## Seeded Dataset (Kaveri Silks & Textiles)
- **Showroom**: Kaveri Silks & Textiles (Flagship Showroom, Bengaluru)
- **Employees**: **30 Indian employees** (`RW001` – `RW030`) across **6 Textile Departments**:
  - Silk & Sarees (`SILK`)
  - Ethnic & Bridal (`ETHN`)
  - Menswear & Formals (`MENS`)
  - Kids & Casuals (`KIDS`)
  - Home & Linen (`HOME`)
  - Billing & Care (`BILL`)
- **Duration**: **4 Months** (`2026-07-12` to `2026-11-11`) — 3,087 sales rows, 3,690 attendance logs, 902 customer feedback entries, 415 recognitions, and 8 AI reward recommendations.

## Quick Start (Zero-Config Local Mode)
Rewardly ships with a local SQLite mirror (`node:sqlite`) that matches the exact Supabase PostgreSQL schema so you can run immediately without cloud credentials:

```bash
npm install
npm --prefix client install
npm run seed
npm run build
npm start
```

Open `http://localhost:3000`.

## Supabase Cloud Mode
1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in the **Supabase SQL Editor**.
2. Seed the 4-month, 30-employee dataset either by:
   - Running [`supabase/seed.sql`](supabase/seed.sql) in the Supabase SQL Editor, **or**
   - Copying `.env.example` to `.env`, setting `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`), and running:
     ```bash
     npm run seed:supabase
     ```
3. Start the server (`npm start`). Rewardly automatically detects valid Supabase credentials and routes all API queries to `@supabase/supabase-js`.

## UI Pages
1. **Dashboard (`/`)**:
   - Global Date Range & Textile Department filters
   - 4 Executive KPI cards (Employees, Performance Score, Attendance & Loyalty, Net Sales & Rating)
   - Monthly Performance/Sales Trend & Department Comparison Charts
   - Recognition by Type Donut Chart & Top Recognized Employees leaderboard
   - Full 30-Employee Modal & Individual Scorecard with manual formula verification
   - **Rewardly AI Assistant** (`Custom Dashboard` Q&A with inline Chart.js visualizations + `AI Insights` & Reward Approval Queue)
   - Give Recognition & Import POS CSV modals
2. **Settings (`/settings`)**:
   - **Exposed Date-Range Export API (Copy Link)**: Pick Start/End dates, department, dataset scope, format (`JSON` or `CSV`), optional API token, preview live response, and click **Copy API Link**.
   - **Configurable Performance Weights**: Tune Sales, Attendance, Feedback, and Recognition weights (recalculates all scores live).
   - **Showroom Profile**, **Supabase Connection Tester**, **Schema Viewer**, and **4-Month Seed Reset**.

## Exposed Date-Range Export API
```http
GET /api/public/export?startDate=2026-07-12&endDate=2026-11-11&department=all&include=all&format=json
```
Alias: `GET /api/v1/export/all`

Returns filtered `meta`, `kpis`, `departments`, `employees`, `sales_records`, `attendance_records`, `customer_feedback`, `recognitions`, and `reward_recommendations` for the specified date range.

