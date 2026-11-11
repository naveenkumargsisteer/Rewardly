-- ============================================================================
-- Rewardly: AI-Powered Employee Performance, Loyalty & Reward Recognition System
-- Supabase PostgreSQL Schema
-- Shop: Kaveri Silks & Textiles (Flagship Showroom)
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Shops
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT,
  location TEXT,
  city TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  owner_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Departments
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  target_monthly_sales NUMERIC(12, 2) NOT NULL DEFAULT 1000000,
  color_hex TEXT NOT NULL DEFAULT '#7C3AED',
  UNIQUE (shop_id, code)
);

-- 3. Employees
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  emp_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  gender TEXT,
  role TEXT NOT NULL,
  shift TEXT NOT NULL DEFAULT 'Morning (10:00-19:30)',
  join_date DATE NOT NULL,
  base_salary_inr NUMERIC(10, 2) NOT NULL DEFAULT 25000,
  avatar_initials TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

-- 4. Sales Records (Daily / Shift POS aggregation per employee)
CREATE TABLE IF NOT EXISTS sales_records (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  bills_count INTEGER NOT NULL DEFAULT 0,
  items_sold INTEGER NOT NULL DEFAULT 0,
  gross_amount_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  returns_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_amount_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  upsell_count INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL
);

-- 5. Attendance Records
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Late', 'Half-Day', 'Leave', 'Weekly-Off')),
  check_in TEXT,
  check_out TEXT,
  hours_worked NUMERIC(4, 2) NOT NULL DEFAULT 0,
  late_minutes INTEGER NOT NULL DEFAULT 0
);

-- 6. Customer Feedback
CREATE TABLE IF NOT EXISTS customer_feedback (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  feedback_date DATE NOT NULL,
  rating NUMERIC(2, 1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  sentiment TEXT NOT NULL CHECK (sentiment IN ('Positive', 'Neutral', 'Needs-Attention')),
  customer_name TEXT,
  comment TEXT,
  channel TEXT NOT NULL DEFAULT 'In-Store QR'
);

-- 7. Recognitions (Peer-to-Peer, Manager, Customer Praise, Milestone)
CREATE TABLE IF NOT EXISTS recognitions (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  given_by_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  given_by_name TEXT NOT NULL,
  recognition_type TEXT NOT NULL CHECK (recognition_type IN ('Peer-to-Peer', 'Manager', 'Customer Praise', 'Milestone')),
  badge_title TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 10,
  message TEXT NOT NULL,
  recognition_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Approved' CHECK (status IN ('Approved', 'Pending', 'Rejected'))
);

-- 8. AI Reward Recommendations (Owner approval queue)
CREATE TABLE IF NOT EXISTS reward_recommendations (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  composite_score NUMERIC(5, 2) NOT NULL,
  reward_title TEXT NOT NULL,
  bonus_amount_inr NUMERIC(10, 2) NOT NULL DEFAULT 0,
  rationale TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Dismissed')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Configurable Scoring & Export API Settings
CREATE TABLE IF NOT EXISTS scoring_settings (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
  sales_weight INTEGER NOT NULL DEFAULT 40,
  attendance_weight INTEGER NOT NULL DEFAULT 25,
  feedback_weight INTEGER NOT NULL DEFAULT 20,
  recognition_weight INTEGER NOT NULL DEFAULT 15,
  gold_threshold INTEGER NOT NULL DEFAULT 85,
  silver_threshold INTEGER NOT NULL DEFAULT 72,
  public_export_token TEXT NOT NULL DEFAULT 'rw_live_kaveri_2026',
  require_export_token BOOLEAN NOT NULL DEFAULT FALSE,
  ai_provider TEXT NOT NULL DEFAULT 'builtin',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Performance Indexes for Date-Range Filtering
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_sales_date_emp ON sales_records(sale_date, employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date_emp ON attendance_records(attendance_date, employee_id);
CREATE INDEX IF NOT EXISTS idx_feedback_date_emp ON customer_feedback(feedback_date, employee_id);
CREATE INDEX IF NOT EXISTS idx_recognitions_date_emp ON recognitions(recognition_date, employee_id);
CREATE INDEX IF NOT EXISTS idx_rewards_status ON reward_recommendations(status, period_start, period_end);

-- ============================================================================
-- Convenience Analytical View (for Supabase Table/SQL Editor inspection)
-- ============================================================================
CREATE OR REPLACE VIEW v_employee_overall_stats AS
SELECT
  e.id AS employee_id,
  e.emp_code,
  e.full_name,
  e.role,
  d.name AS department_name,
  COALESCE(s.total_sales_inr, 0) AS total_sales_inr,
  COALESCE(s.total_bills, 0) AS total_bills,
  COALESCE(a.present_days, 0) AS present_days,
  COALESCE(a.late_days, 0) AS late_days,
  ROUND(COALESCE(f.avg_rating, 0), 2) AS avg_customer_rating,
  COALESCE(r.recognition_points, 0) AS total_recognition_points
FROM employees e
JOIN departments d ON d.id = e.department_id
LEFT JOIN (
  SELECT employee_id, SUM(net_amount_inr) AS total_sales_inr, SUM(bills_count) AS total_bills
  FROM sales_records GROUP BY employee_id
) s ON s.employee_id = e.id
LEFT JOIN (
  SELECT employee_id,
    COUNT(*) FILTER (WHERE status = 'Present') AS present_days,
    COUNT(*) FILTER (WHERE status = 'Late') AS late_days
  FROM attendance_records GROUP BY employee_id
) a ON a.employee_id = e.id
LEFT JOIN (
  SELECT employee_id, AVG(rating) AS avg_rating
  FROM customer_feedback GROUP BY employee_id
) f ON f.employee_id = e.id
LEFT JOIN (
  SELECT employee_id, SUM(points) AS recognition_points
  FROM recognitions WHERE status = 'Approved' GROUP BY employee_id
) r ON r.employee_id = e.id;

-- ============================================================================
-- Row Level Security (RLS)
-- Note: Rewardly Node.js backend uses SUPABASE_SERVICE_ROLE_KEY or anon policy
-- below. Tighten policies for multi-tenant production deployments.
-- ============================================================================
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE recognitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'shops','departments','employees','sales_records','attendance_records',
    'customer_feedback','recognitions','reward_recommendations','scoring_settings'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow full access for prototype" ON %I;', t);
    EXECUTE format('CREATE POLICY "Allow full access for prototype" ON %I FOR ALL USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;

