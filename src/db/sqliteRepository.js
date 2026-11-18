const fs = require('node:fs');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { DB_PATH, runSeed } = require('../../scripts/init-local-db');
const {
  httpError,
  sanitizeDepartmentPayload,
  sanitizeEmployeePayload,
  sanitizePublicFeedbackPayload,
} = require('../utils/crudValidation');
const {
  hashPassword,
  parsePhoneAndAuth,
  packPhoneAndAuth,
  getRoleCategory,
  isPasswordValid,
} = require('../utils/authUtils');

class SqliteRepository {
  constructor() {
    this.ensureDbReady();
    this.db = new DatabaseSync(DB_PATH);
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  ensureDbReady() {
    if (!fs.existsSync(DB_PATH)) {
      runSeed({ writeSql: false, silent: true });
    }
  }

  async getShopAndMeta() {
    const shop = this.db.prepare('SELECT * FROM shops LIMIT 1').get();
    const bounds = this.db.prepare(`
      SELECT
        MIN(d) AS min_date,
        MAX(d) AS max_date
      FROM (
        SELECT sale_date AS d FROM sales_records
        UNION ALL
        SELECT feedback_date AS d FROM customer_feedback
      )
    `).get();

    const counts = {
      employees: this.db.prepare('SELECT COUNT(*) AS c FROM employees').get().c,
      departments: this.db.prepare('SELECT COUNT(*) AS c FROM departments').get().c,
      sales_records: this.db.prepare('SELECT COUNT(*) AS c FROM sales_records').get().c,
      attendance_records: this.db.prepare('SELECT COUNT(*) AS c FROM attendance_records').get().c,
      customer_feedback: this.db.prepare('SELECT COUNT(*) AS c FROM customer_feedback').get().c,
      recognitions: this.db.prepare('SELECT COUNT(*) AS c FROM recognitions').get().c,
      reward_recommendations: this.db.prepare('SELECT COUNT(*) AS c FROM reward_recommendations').get().c,
    };

    return {
      shop,
      dateBounds: {
        minDate: bounds?.min_date || '2026-07-12',
        maxDate: bounds?.max_date || '2026-11-11',
      },
      counts,
    };
  }

  async getDepartments() {
    return this.db.prepare('SELECT * FROM departments ORDER BY target_monthly_sales DESC').all();
  }

  _formatEmployee(row) {
    if (!row) return null;
    const { phone } = parsePhoneAndAuth(row.phone);
    const isPhoto = typeof row.avatar_color === 'string' && row.avatar_color.startsWith('data:image');
    return {
      ...row,
      phone,
      role_category: getRoleCategory(row.role, row.emp_code),
      avatar_url: isPhoto ? row.avatar_color : null,
      avatar_color: isPhoto ? (row.department_color || '#7C3AED') : row.avatar_color,
    };
  }

  _getEmployeeById(id) {
    const raw = this.db.prepare(`
      SELECT e.*, d.code AS department_code, d.name AS department_name, d.color_hex AS department_color, d.target_monthly_sales
      FROM employees e
      JOIN departments d ON d.id = e.department_id
      WHERE e.id = ?
    `).get(id);
    return this._formatEmployee(raw);
  }

  _requireDepartment(departmentId) {
    const dept = this.db.prepare('SELECT * FROM departments WHERE id = ?').get(departmentId);
    if (!dept) throw httpError(400, 'Selected department does not exist.');
    return dept;
  }

  async getEmployees() {
    const rows = this.db.prepare(`
      SELECT e.*, d.code AS department_code, d.name AS department_name, d.color_hex AS department_color, d.target_monthly_sales
      FROM employees e
      JOIN departments d ON d.id = e.department_id
      ORDER BY e.emp_code ASC
    `).all();
    return rows.map((r) => this._formatEmployee(r));
  }

  async createDepartment(payload) {
    const { shop } = await this.getShopAndMeta();
    const clean = sanitizeDepartmentPayload(payload, { isUpdate: false });
    const dup = this.db
      .prepare('SELECT id FROM departments WHERE shop_id = ? AND code = ?')
      .get(shop.id, clean.code);
    if (dup) {
      throw httpError(409, `Department code "${clean.code}" already exists.`);
    }
    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO departments (id, shop_id, code, name, target_monthly_sales, color_hex)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, shop.id, clean.code, clean.name, clean.target_monthly_sales, clean.color_hex);
    return this.db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
  }

  async updateDepartment(id, payload) {
    const current = this.db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
    if (!current) throw httpError(404, 'Department not found.');

    const clean = sanitizeDepartmentPayload(payload, { isUpdate: true });
    if (clean.code && clean.code !== current.code) {
      const dup = this.db
        .prepare('SELECT id FROM departments WHERE shop_id = ? AND code = ? AND id != ?')
        .get(current.shop_id, clean.code, id);
      if (dup) {
        throw httpError(409, `Department code "${clean.code}" already exists.`);
      }
    }

    const next = { ...current, ...clean };
    this.db.prepare(`
      UPDATE departments
      SET code = ?, name = ?, target_monthly_sales = ?, color_hex = ?
      WHERE id = ?
    `).run(next.code, next.name, next.target_monthly_sales, next.color_hex, id);
    return this.db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
  }

  async deleteDepartment(id) {
    const current = this.db.prepare('SELECT id, name FROM departments WHERE id = ?').get(id);
    if (!current) throw httpError(404, 'Department not found.');

    const row = this.db.prepare('SELECT COUNT(*) AS c FROM employees WHERE department_id = ?').get(id);
    const count = Number(row?.c || 0);
    if (count > 0) {
      throw httpError(
        409,
        `Cannot delete "${current.name}" while ${count} employee${count === 1 ? ' is' : 's are'} assigned to it. Reassign or delete them first.`
      );
    }

    this.db.prepare('DELETE FROM departments WHERE id = ?').run(id);
    return { deleted: true, id };
  }

  async createEmployee(payload) {
    const { shop } = await this.getShopAndMeta();
    const deptId = String(payload?.department_id || '').trim();
    if (!deptId) throw httpError(400, 'Department is required.');
    const dept = this._requireDepartment(deptId);

    const clean = sanitizeEmployeePayload(payload, {
      isUpdate: false,
      fallbackColor: dept.color_hex || '#7C3AED',
    });

    const dup = this.db.prepare('SELECT id FROM employees WHERE emp_code = ?').get(clean.emp_code);
    if (dup) {
      throw httpError(409, `Employee code "${clean.emp_code}" already exists.`);
    }

    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO employees (
        id, shop_id, department_id, emp_code, full_name, email,
        phone, gender, role, shift, join_date, base_salary_inr,
        avatar_initials, avatar_color, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      shop.id,
      clean.department_id,
      clean.emp_code,
      clean.full_name,
      clean.email,
      clean.phone,
      clean.gender,
      clean.role,
      clean.shift,
      clean.join_date,
      clean.base_salary_inr,
      clean.avatar_initials,
      clean.avatar_color,
      clean.status
    );
    return this._getEmployeeById(id);
  }

  async updateEmployee(id, payload) {
    const current = this.db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!current) throw httpError(404, 'Employee not found.');

    let fallbackColor = current.avatar_color || '#7C3AED';
    if (payload?.department_id !== undefined && payload.department_id !== current.department_id) {
      const nextDept = this._requireDepartment(String(payload.department_id).trim());
      fallbackColor = nextDept.color_hex || fallbackColor;
    }

    const clean = sanitizeEmployeePayload(payload, { isUpdate: true, fallbackColor });
    if (clean.emp_code && clean.emp_code !== current.emp_code) {
      const dup = this.db
        .prepare('SELECT id FROM employees WHERE emp_code = ? AND id != ?')
        .get(clean.emp_code, id);
      if (dup) {
        throw httpError(409, `Employee code "${clean.emp_code}" already exists.`);
      }
    }

    const next = { ...current, ...clean };
    this.db.prepare(`
      UPDATE employees
      SET department_id = ?, emp_code = ?, full_name = ?, email = ?,
          phone = ?, gender = ?, role = ?, shift = ?, join_date = ?,
          base_salary_inr = ?, avatar_initials = ?, avatar_color = ?, status = ?
      WHERE id = ?
    `).run(
      next.department_id,
      next.emp_code,
      next.full_name,
      next.email,
      next.phone,
      next.gender,
      next.role,
      next.shift,
      next.join_date,
      next.base_salary_inr,
      next.avatar_initials,
      next.avatar_color,
      next.status,
      id
    );
    return this._getEmployeeById(id);
  }

  async deleteEmployee(id) {
    const current = this.db.prepare('SELECT id FROM employees WHERE id = ?').get(id);
    if (!current) throw httpError(404, 'Employee not found.');

    this.db.exec('BEGIN;');
    try {
      this.db.prepare('DELETE FROM sales_records WHERE employee_id = ?').run(id);
      this.db.prepare('DELETE FROM attendance_records WHERE employee_id = ?').run(id);
      this.db.prepare('DELETE FROM customer_feedback WHERE employee_id = ?').run(id);
      this.db.prepare('DELETE FROM recognitions WHERE employee_id = ?').run(id);
      this.db.prepare('UPDATE recognitions SET given_by_employee_id = NULL WHERE given_by_employee_id = ?').run(id);
      this.db.prepare('DELETE FROM reward_recommendations WHERE employee_id = ?').run(id);
      this.db.prepare('DELETE FROM employees WHERE id = ?').run(id);
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
    return { deleted: true, id };
  }

  async getSettings() {
    const row = this.db.prepare('SELECT * FROM scoring_settings LIMIT 1').get();
    return {
      ...row,
      require_export_token: Boolean(row.require_export_token),
    };
  }

  async updateSettings(patch) {
    const current = await this.getSettings();
    const next = {
      sales_weight: patch.sales_weight ?? current.sales_weight,
      attendance_weight: patch.attendance_weight ?? current.attendance_weight,
      feedback_weight: patch.feedback_weight ?? current.feedback_weight,
      recognition_weight: patch.recognition_weight ?? current.recognition_weight,
      gold_threshold: patch.gold_threshold ?? current.gold_threshold,
      silver_threshold: patch.silver_threshold ?? current.silver_threshold,
      public_export_token: patch.public_export_token ?? current.public_export_token,
      require_export_token: patch.require_export_token !== undefined
        ? (patch.require_export_token ? 1 : 0)
        : (current.require_export_token ? 1 : 0),
      ai_provider: patch.ai_provider ?? current.ai_provider,
    };

    this.db.prepare(`
      UPDATE scoring_settings
      SET sales_weight = ?, attendance_weight = ?, feedback_weight = ?, recognition_weight = ?,
          gold_threshold = ?, silver_threshold = ?, public_export_token = ?, require_export_token = ?,
          ai_provider = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      next.sales_weight,
      next.attendance_weight,
      next.feedback_weight,
      next.recognition_weight,
      next.gold_threshold,
      next.silver_threshold,
      next.public_export_token,
      next.require_export_token,
      next.ai_provider,
      current.id
    );

    return this.getSettings();
  }

  async updateShop(patch) {
    const { shop } = await this.getShopAndMeta();
    this.db.prepare(`
      UPDATE shops
      SET name = ?, tagline = ?, location = ?, city = ?, owner_name = ?
      WHERE id = ?
    `).run(
      patch.name ?? shop.name,
      patch.tagline ?? shop.tagline,
      patch.location ?? shop.location,
      patch.city ?? shop.city,
      patch.owner_name ?? shop.owner_name,
      shop.id
    );
    return (await this.getShopAndMeta()).shop;
  }

  async getPeriodData({ startDate, endDate, departmentCode }) {
    const hasDeptFilter = Boolean(departmentCode && departmentCode !== 'all');
    let employeeIds = null;

    if (hasDeptFilter) {
      const deptEmployees = this.db.prepare(`
        SELECT e.id FROM employees e
        JOIN departments d ON d.id = e.department_id
        WHERE d.code = ? OR d.id = ?
      `).all(departmentCode, departmentCode);
      employeeIds = deptEmployees.map((r) => r.id);
      if (employeeIds.length === 0) {
        return { sales: [], attendance: [], feedback: [], recognitions: [], rewards: [] };
      }
    }

    const empClause = employeeIds
      ? ` AND employee_id IN (${employeeIds.map(() => '?').join(',')})`
      : '';
    const empParams = employeeIds || [];

    const sales = this.db.prepare(`
      SELECT * FROM sales_records
      WHERE sale_date >= ? AND sale_date <= ?${empClause}
      ORDER BY sale_date ASC
    `).all(startDate, endDate, ...empParams);

    const attendance = this.db.prepare(`
      SELECT * FROM attendance_records
      WHERE attendance_date >= ? AND attendance_date <= ?${empClause}
      ORDER BY attendance_date ASC
    `).all(startDate, endDate, ...empParams);

    const feedback = this.db.prepare(`
      SELECT * FROM customer_feedback
      WHERE feedback_date >= ? AND feedback_date <= ?${empClause}
      ORDER BY feedback_date DESC
    `).all(startDate, endDate, ...empParams);

    const recognitions = this.db.prepare(`
      SELECT * FROM recognitions
      WHERE recognition_date >= ? AND recognition_date <= ?${empClause}
      ORDER BY recognition_date DESC
    `).all(startDate, endDate, ...empParams);

    const rewards = this.db.prepare(`
      SELECT r.*, e.full_name AS employee_name, e.emp_code, e.role, e.avatar_initials, e.avatar_color, d.name AS department_name, d.code AS department_code
      FROM reward_recommendations r
      JOIN employees e ON e.id = r.employee_id
      JOIN departments d ON d.id = e.department_id
      WHERE r.period_end >= ? AND r.period_start <= ?${employeeIds ? ` AND r.employee_id IN (${employeeIds.map(() => '?').join(',')})` : ''}
      ORDER BY r.composite_score DESC
    `).all(startDate, endDate, ...empParams);

    return { sales, attendance, feedback, recognitions, rewards };
  }

  async createRecognition({ employee_id, given_by_name, recognition_type, badge_title, points, message, recognition_date }) {
    const { shop } = await this.getShopAndMeta();
    const id = crypto.randomUUID();
    const dateVal = recognition_date || new Date().toISOString().slice(0, 10);
    this.db.prepare(`
      INSERT INTO recognitions (id, shop_id, employee_id, given_by_employee_id, given_by_name, recognition_type, badge_title, points, message, recognition_date, status)
      VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'Approved')
    `).run(id, shop.id, employee_id, given_by_name, recognition_type, badge_title, Number(points) || 25, message, dateVal);

    return this.db.prepare('SELECT * FROM recognitions WHERE id = ?').get(id);
  }

  async updateRewardRecommendation(id, { status, reviewedBy }) {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE reward_recommendations
      SET status = ?, reviewed_by = ?, reviewed_at = ?
      WHERE id = ?
    `).run(status, reviewedBy || 'Showroom Owner', now, id);

    return this.db.prepare(`
      SELECT r.*, e.full_name AS employee_name, e.emp_code, e.role, e.avatar_initials, e.avatar_color, d.name AS department_name
      FROM reward_recommendations r
      JOIN employees e ON e.id = r.employee_id
      JOIN departments d ON d.id = e.department_id
      WHERE r.id = ?
    `).get(id);
  }

  async getEmployeePublicTarget(empRef) {
    const ref = String(empRef || '').trim();
    if (!ref) {
      throw httpError(400, 'Employee feedback code is required.');
    }

    const emp = this.db.prepare(`
      SELECT e.id, e.shop_id, e.emp_code, e.full_name, e.role, e.avatar_initials, e.avatar_color, e.status,
             d.name AS department_name, d.color_hex AS department_color
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE LOWER(e.emp_code) = LOWER(?) OR e.id = ?
      LIMIT 1
    `).get(ref, ref);

    if (!emp) {
      throw httpError(404, 'Employee feedback link not found.');
    }

    const shop = this.db.prepare(`
      SELECT id, name, tagline, location, city
      FROM shops
      WHERE id = ?
      LIMIT 1
    `).get(emp.shop_id);

    return {
      shop: shop || null,
      employee: {
        id: emp.id,
        emp_code: emp.emp_code,
        full_name: emp.full_name,
        role: emp.role,
        avatar_initials: emp.avatar_initials,
        avatar_color: emp.avatar_color,
        status: emp.status,
        department_name: emp.department_name || '',
        department_color: emp.department_color || '#7C3AED',
      },
    };
  }

  async hasBillSubmittedFeedback(billRef) {
    if (!billRef) return false;
    const cleanBill = String(billRef).trim();
    if (!cleanBill) return false;
    const row = this.db
      .prepare('SELECT id FROM customer_feedback WHERE channel LIKE ? LIMIT 1')
      .get(`%[bill: ${cleanBill}]%`);
    return Boolean(row);
  }

  async createPublicFeedback(payload) {
    const clean = sanitizePublicFeedbackPayload(payload);
    const billRef = (payload.bill || payload.invoice_no || '').trim();

    if (billRef) {
      const alreadySubmitted = await this.hasBillSubmittedFeedback(billRef);
      if (alreadySubmitted) {
        throw httpError(409, `Feedback for Bill/Invoice #${billRef} has already been submitted.`);
      }
    }

    const target = await this.getEmployeePublicTarget(clean.empRef);
    const channel = billRef ? `Bill Receipt QR [bill: ${billRef}]` : clean.channel || 'Customer QR Feedback';

    const row = {
      id: crypto.randomUUID(),
      shop_id: target.shop.id,
      employee_id: target.employee.id,
      feedback_date: clean.feedback_date,
      rating: clean.rating,
      sentiment: clean.sentiment,
      customer_name: clean.customer_name,
      comment: clean.comment,
      channel,
    };

    this.db.prepare(`
      INSERT INTO customer_feedback (id, shop_id, employee_id, feedback_date, rating, sentiment, customer_name, comment, channel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.id,
      row.shop_id,
      row.employee_id,
      row.feedback_date,
      row.rating,
      row.sentiment,
      row.customer_name,
      row.comment,
      row.channel
    );

    return {
      ...row,
      employee_name: target.employee.full_name,
      emp_code: target.employee.emp_code,
      department_name: target.employee.department_name,
      shop_name: target.shop.name,
    };
  }

  async authenticateEmployee(empCode, password) {
    const code = String(empCode || '').trim().toUpperCase();
    const pwd = String(password || '').trim();
    if (!code || !pwd) {
      throw httpError(400, 'Employee ID and password are required.');
    }

    const row = this.db.prepare(`
      SELECT e.*, d.code AS department_code, d.name AS department_name, d.color_hex AS department_color, d.target_monthly_sales
      FROM employees e
      JOIN departments d ON d.id = e.department_id
      WHERE LOWER(e.emp_code) = LOWER(?)
      LIMIT 1
    `).get(code);

    if (!row) {
      throw httpError(404, `Employee ID "${code}" not found. Please verify your Employee Code.`);
    }

    const { passwordHash } = parsePhoneAndAuth(row.phone);
    const valid = isPasswordValid(pwd, passwordHash, row.emp_code);

    if (!valid) {
      throw httpError(401, 'Invalid password. If you forgot your password, please use "Forgot Password".');
    }

    return {
      token: `rw_emp_${row.id}_${Date.now()}`,
      employee: this._formatEmployee(row),
      isDefaultPassword: !passwordHash,
    };
  }

  async resetEmployeePassword(empCode, verification, newPassword) {
    const code = String(empCode || '').trim().toUpperCase();
    const v = String(verification || '').trim().toLowerCase();
    const pwd = String(newPassword || '').trim();

    if (!code || !v || !pwd) {
      throw httpError(400, 'Employee ID, verification (email/phone), and new password are required.');
    }
    if (pwd.length < 4) {
      throw httpError(400, 'Password must be at least 4 characters long.');
    }

    const row = this.db.prepare(`
      SELECT id, emp_code, full_name, email, phone
      FROM employees
      WHERE LOWER(emp_code) = LOWER(?)
      LIMIT 1
    `).get(code);

    if (!row) {
      throw httpError(404, `Employee ID "${code}" not found.`);
    }

    const { phone: cleanPhone } = parsePhoneAndAuth(row.phone);
    const empEmail = String(row.email || '').trim().toLowerCase();
    const empPhoneDigits = cleanPhone.replace(/[^0-9]/g, '');
    const vDigits = v.replace(/[^0-9]/g, '');

    const emailMatch = v === empEmail;
    const phoneMatch = Boolean(vDigits && (empPhoneDigits === vDigits || (vDigits.length >= 4 && empPhoneDigits.endsWith(vDigits))));

    if (!emailMatch && !phoneMatch) {
      throw httpError(400, 'Verification failed. Please enter the registered Email or Phone number on file for this employee.');
    }

    const newHash = hashPassword(pwd);
    const packed = packPhoneAndAuth(cleanPhone, newHash);

    this.db.prepare('UPDATE employees SET phone = ? WHERE id = ?').run(packed, row.id);

    return {
      success: true,
      message: `Password has been reset successfully for ${row.full_name} (${row.emp_code}). You can now log in.`,
      employee: this._formatEmployee(this._getEmployeeById(row.id)),
    };
  }

  async updateEmployeeAvatar(empId, avatarUrl) {
    const id = String(empId || '').trim();
    if (!id) throw httpError(400, 'Employee ID is required.');

    const emp = this._getEmployeeById(id);
    if (!emp) throw httpError(404, 'Employee not found.');

    const fallbackColor = emp.department_color || '#7C3AED';
    const nextColorVal = avatarUrl && String(avatarUrl).startsWith('data:image')
      ? avatarUrl
      : fallbackColor;

    this.db.prepare('UPDATE employees SET avatar_color = ? WHERE id = ?').run(nextColorVal, id);
    return this._getEmployeeById(id);
  }

  async createBillingInvoice(payload) {
    const { shop } = await this.getShopAndMeta();
    const salesEmpId = String(payload.sales_employee_id || '').trim();
    if (!salesEmpId) {
      throw httpError(400, 'Assisted Sales Staff is required for showroom sales attribution.');
    }

    const row = this.db.prepare(`
      SELECT e.*, d.code AS department_code, d.name AS department_name, d.color_hex AS department_color, d.target_monthly_sales
      FROM employees e
      JOIN departments d ON d.id = e.department_id
      WHERE e.id = ? OR LOWER(e.emp_code) = LOWER(?)
      LIMIT 1
    `).get(salesEmpId, salesEmpId);

    if (!row) {
      throw httpError(404, `Sales staff with ID "${salesEmpId}" not found.`);
    }

    const netAmount = Math.max(0, Math.round(Number(payload.net_amount || payload.gross_amount || 0)));
    const grossAmount = Math.max(netAmount, Math.round(Number(payload.gross_amount || netAmount)));
    const saleDate = payload.sale_date || new Date().toISOString().slice(0, 10);
    const invoiceNo = payload.invoice_no || `INV-${Date.now().toString().slice(-6)}`;
    const saleId = crypto.randomUUID();

    this.db.prepare(`
      INSERT INTO sales_records (id, shop_id, employee_id, sale_date, bills_count, items_sold, gross_amount_inr, returns_inr, net_amount_inr, upsell_count, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      saleId,
      shop.id,
      row.id,
      saleDate,
      1,
      (payload.items || []).length || 1,
      grossAmount,
      0,
      netAmount,
      0,
      row.department_name
    );

    const invoice = {
      id: saleId,
      invoice_no: invoiceNo,
      counter_id: payload.counter_id || 'POS-KVR-01',
      cashier_id: payload.cashier_id || 'CASH01',
      cashier_name: payload.cashier_name || 'Harshvardhan Singh',
      sales_employee_id: row.id,
      sales_emp_code: row.emp_code,
      sales_employee_name: row.full_name,
      customer_name: payload.customer_name || 'Walk-in Customer',
      customer_phone: payload.customer_phone || '',
      items: payload.items || [],
      items_count: (payload.items || []).reduce((sum, it) => sum + (Number(it.qty) || 1), 0),
      gross_amount: grossAmount,
      discount_amount: Number(payload.discount_amount || 0),
      tax_amount: Number(payload.tax_amount || Math.round(netAmount * 0.05)),
      net_amount: netAmount,
      payment_method: payload.payment_method || 'UPI',
      created_at: new Date().toISOString(),
    };

    return {
      success: true,
      message: `Invoice ${invoiceNo} completed! ₹${netAmount.toLocaleString('en-IN')} credited to ${row.full_name} (${row.emp_code}).`,
      invoice,
      salesEmployee: this._formatEmployee(row),
    };
  }

  async insertSalesRows(rows) {
    const { shop } = await this.getShopAndMeta();
    const emps = await this.getEmployees();
    const byCode = Object.fromEntries(emps.map((e) => [e.emp_code.toUpperCase(), e]));

    const stmt = this.db.prepare(`
      INSERT INTO sales_records (id, shop_id, employee_id, sale_date, bills_count, items_sold, gross_amount_inr, returns_inr, net_amount_inr, upsell_count, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    const skipped = [];

    this.db.exec('BEGIN;');
    try {
      for (const r of rows) {
        const emp = byCode[String(r.emp_code || '').trim().toUpperCase()];
        if (!emp) {
          skipped.push(r.emp_code || 'unknown');
          continue;
        }
        const gross = Number(r.gross_amount_inr || r.net_amount_inr || 0);
        const returns = Number(r.returns_inr || 0);
        const net = Number(r.net_amount_inr ?? Math.max(0, gross - returns));
        stmt.run(
          crypto.randomUUID(),
          shop.id,
          emp.id,
          r.sale_date,
          Number(r.bills_count || 1),
          Number(r.items_sold || 1),
          gross,
          returns,
          net,
          Number(r.upsell_count || 0),
          r.category || emp.department_name
        );
        inserted++;
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    return { inserted, skipped };
  }

  async resetAndReseed() {
    this.db.close();
    const dataset = runSeed({ writeSql: true, silent: true });
    this.db = new DatabaseSync(DB_PATH);
    this.db.exec('PRAGMA foreign_keys = ON;');
    return {
      reset: true,
      employees: dataset.employees.length,
      sales_records: dataset.sales_records.length,
      attendance_records: dataset.attendance_records.length,
    };
  }
}

module.exports = SqliteRepository;

