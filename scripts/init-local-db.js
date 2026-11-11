const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { generateSeedDataset } = require('./seed-data-generator');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'rewardly.db');
const SUPABASE_SEED_PATH = path.join(ROOT_DIR, 'supabase', 'seed.sql');

function sqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function buildBatchInsertSql(table, columns, rows, chunkSize = 400) {
  if (!rows.length) return '';
  const chunks = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const valuesSql = slice
      .map((row) => `(${columns.map((c) => sqlVal(row[c])).join(', ')})`)
      .join(',\n');
    chunks.push(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${valuesSql}\nON CONFLICT (id) DO NOTHING;\n`
    );
  }
  return chunks.join('\n');
}

function writeSupabaseSeedSql(dataset) {
  const parts = [
    '-- ============================================================================',
    '-- Rewardly Seed SQL for Supabase PostgreSQL',
    `-- Shop: ${dataset.shop.name}`,
    `-- Employees: ${dataset.employees.length} | Window: ${dataset.meta.start_date} to ${dataset.meta.end_date}`,
    '-- Run supabase/schema.sql first, then execute this seed file.',
    '-- ============================================================================\n',
    'BEGIN;\n',
    buildBatchInsertSql(
      'shops',
      ['id', 'name', 'tagline', 'location', 'city', 'currency', 'owner_name'],
      [dataset.shop]
    ),
    buildBatchInsertSql(
      'departments',
      ['id', 'shop_id', 'code', 'name', 'target_monthly_sales', 'color_hex'],
      dataset.departments
    ),
    buildBatchInsertSql(
      'employees',
      [
        'id', 'shop_id', 'department_id', 'emp_code', 'full_name', 'email',
        'phone', 'gender', 'role', 'shift', 'join_date', 'base_salary_inr',
        'avatar_initials', 'avatar_color', 'status',
      ],
      dataset.employees
    ),
    buildBatchInsertSql(
      'sales_records',
      [
        'id', 'shop_id', 'employee_id', 'sale_date', 'bills_count', 'items_sold',
        'gross_amount_inr', 'returns_inr', 'net_amount_inr', 'upsell_count', 'category',
      ],
      dataset.sales_records
    ),
    buildBatchInsertSql(
      'attendance_records',
      [
        'id', 'shop_id', 'employee_id', 'attendance_date', 'status',
        'check_in', 'check_out', 'hours_worked', 'late_minutes',
      ],
      dataset.attendance_records
    ),
    buildBatchInsertSql(
      'customer_feedback',
      [
        'id', 'shop_id', 'employee_id', 'feedback_date', 'rating',
        'sentiment', 'customer_name', 'comment', 'channel',
      ],
      dataset.customer_feedback
    ),
    buildBatchInsertSql(
      'recognitions',
      [
        'id', 'shop_id', 'employee_id', 'given_by_employee_id', 'given_by_name',
        'recognition_type', 'badge_title', 'points', 'message', 'recognition_date', 'status',
      ],
      dataset.recognitions
    ),
    buildBatchInsertSql(
      'reward_recommendations',
      [
        'id', 'shop_id', 'employee_id', 'period_start', 'period_end', 'composite_score',
        'reward_title', 'bonus_amount_inr', 'rationale', 'status', 'reviewed_by', 'reviewed_at',
      ],
      dataset.reward_recommendations
    ),
    buildBatchInsertSql(
      'scoring_settings',
      [
        'id', 'shop_id', 'sales_weight', 'attendance_weight', 'feedback_weight',
        'recognition_weight', 'gold_threshold', 'silver_threshold',
        'public_export_token', 'require_export_token', 'ai_provider',
      ],
      [dataset.scoring_settings]
    ),
    'COMMIT;\n',
  ];

  fs.mkdirSync(path.dirname(SUPABASE_SEED_PATH), { recursive: true });
  fs.writeFileSync(SUPABASE_SEED_PATH, parts.join('\n'), 'utf8');
}

function initSqliteDb(dataset, { silent = false } = {}) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE shops (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tagline TEXT,
      location TEXT,
      city TEXT,
      currency TEXT NOT NULL DEFAULT 'INR',
      owner_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE departments (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      target_monthly_sales REAL NOT NULL DEFAULT 1000000,
      color_hex TEXT NOT NULL DEFAULT '#7C3AED',
      UNIQUE (shop_id, code)
    );

    CREATE TABLE employees (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      department_id TEXT NOT NULL REFERENCES departments(id),
      emp_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      gender TEXT,
      role TEXT NOT NULL,
      shift TEXT NOT NULL,
      join_date TEXT NOT NULL,
      base_salary_inr REAL NOT NULL,
      avatar_initials TEXT NOT NULL,
      avatar_color TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE sales_records (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      sale_date TEXT NOT NULL,
      bills_count INTEGER NOT NULL DEFAULT 0,
      items_sold INTEGER NOT NULL DEFAULT 0,
      gross_amount_inr REAL NOT NULL DEFAULT 0,
      returns_inr REAL NOT NULL DEFAULT 0,
      net_amount_inr REAL NOT NULL DEFAULT 0,
      upsell_count INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL
    );

    CREATE TABLE attendance_records (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      attendance_date TEXT NOT NULL,
      status TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      hours_worked REAL NOT NULL DEFAULT 0,
      late_minutes INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE customer_feedback (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      feedback_date TEXT NOT NULL,
      rating REAL NOT NULL,
      sentiment TEXT NOT NULL,
      customer_name TEXT,
      comment TEXT,
      channel TEXT NOT NULL DEFAULT 'In-Store QR'
    );

    CREATE TABLE recognitions (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      given_by_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
      given_by_name TEXT NOT NULL,
      recognition_type TEXT NOT NULL,
      badge_title TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 10,
      message TEXT NOT NULL,
      recognition_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Approved'
    );

    CREATE TABLE reward_recommendations (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      composite_score REAL NOT NULL,
      reward_title TEXT NOT NULL,
      bonus_amount_inr REAL NOT NULL DEFAULT 0,
      rationale TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE scoring_settings (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
      sales_weight INTEGER NOT NULL DEFAULT 40,
      attendance_weight INTEGER NOT NULL DEFAULT 25,
      feedback_weight INTEGER NOT NULL DEFAULT 20,
      recognition_weight INTEGER NOT NULL DEFAULT 15,
      gold_threshold INTEGER NOT NULL DEFAULT 85,
      silver_threshold INTEGER NOT NULL DEFAULT 72,
      public_export_token TEXT NOT NULL DEFAULT 'rw_live_kaveri_2026',
      require_export_token INTEGER NOT NULL DEFAULT 0,
      ai_provider TEXT NOT NULL DEFAULT 'builtin',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_sales_date_emp ON sales_records(sale_date, employee_id);
    CREATE INDEX idx_attendance_date_emp ON attendance_records(attendance_date, employee_id);
    CREATE INDEX idx_feedback_date_emp ON customer_feedback(feedback_date, employee_id);
    CREATE INDEX idx_recognitions_date_emp ON recognitions(recognition_date, employee_id);
  `);

  const insertMany = (table, cols, rows) => {
    const placeholders = cols.map(() => '?').join(', ');
    const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`);
    for (const row of rows) {
      stmt.run(...cols.map((c) => {
        const v = row[c];
        if (typeof v === 'boolean') return v ? 1 : 0;
        return v === undefined ? null : v;
      }));
    }
  };

  db.exec('BEGIN;');
  insertMany('shops', ['id', 'name', 'tagline', 'location', 'city', 'currency', 'owner_name'], [dataset.shop]);
  insertMany('departments', ['id', 'shop_id', 'code', 'name', 'target_monthly_sales', 'color_hex'], dataset.departments);
  insertMany(
    'employees',
    ['id', 'shop_id', 'department_id', 'emp_code', 'full_name', 'email', 'phone', 'gender', 'role', 'shift', 'join_date', 'base_salary_inr', 'avatar_initials', 'avatar_color', 'status'],
    dataset.employees
  );
  insertMany(
    'sales_records',
    ['id', 'shop_id', 'employee_id', 'sale_date', 'bills_count', 'items_sold', 'gross_amount_inr', 'returns_inr', 'net_amount_inr', 'upsell_count', 'category'],
    dataset.sales_records
  );
  insertMany(
    'attendance_records',
    ['id', 'shop_id', 'employee_id', 'attendance_date', 'status', 'check_in', 'check_out', 'hours_worked', 'late_minutes'],
    dataset.attendance_records
  );
  insertMany(
    'customer_feedback',
    ['id', 'shop_id', 'employee_id', 'feedback_date', 'rating', 'sentiment', 'customer_name', 'comment', 'channel'],
    dataset.customer_feedback
  );
  insertMany(
    'recognitions',
    ['id', 'shop_id', 'employee_id', 'given_by_employee_id', 'given_by_name', 'recognition_type', 'badge_title', 'points', 'message', 'recognition_date', 'status'],
    dataset.recognitions
  );
  insertMany(
    'reward_recommendations',
    ['id', 'shop_id', 'employee_id', 'period_start', 'period_end', 'composite_score', 'reward_title', 'bonus_amount_inr', 'rationale', 'status', 'reviewed_by', 'reviewed_at'],
    dataset.reward_recommendations
  );
  insertMany(
    'scoring_settings',
    ['id', 'shop_id', 'sales_weight', 'attendance_weight', 'feedback_weight', 'recognition_weight', 'gold_threshold', 'silver_threshold', 'public_export_token', 'require_export_token', 'ai_provider'],
    [dataset.scoring_settings]
  );
  db.exec('COMMIT;');
  db.close();

  if (!silent) {
    console.log(`Seeded Rewardly SQLite DB at: ${DB_PATH}`);
    console.log(`Generated Supabase Seed SQL at: ${SUPABASE_SEED_PATH}`);
    console.log(`Summary -> Shop: ${dataset.shop.name}`);
    console.log(`Employees: ${dataset.employees.length} | Departments: ${dataset.departments.length}`);
    console.log(`Date Range: ${dataset.meta.start_date} to ${dataset.meta.end_date}`);
    console.log(`Sales rows: ${dataset.sales_records.length} | Attendance rows: ${dataset.attendance_records.length}`);
    console.log(`Feedback rows: ${dataset.customer_feedback.length} | Recognitions: ${dataset.recognitions.length}`);
  }
}

function runSeed({ writeSql = true, silent = false } = {}) {
  const dataset = generateSeedDataset();
  initSqliteDb(dataset, { silent });
  if (writeSql) {
    writeSupabaseSeedSql(dataset);
  }
  return dataset;
}

if (require.main === module) {
  runSeed();
}

module.exports = {
  runSeed,
  DB_PATH,
};

