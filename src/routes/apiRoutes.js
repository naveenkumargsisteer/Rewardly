const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { getRepository, getBackendStatus, testSupabaseConnection } = require('../db');
const { getDashboardAnalytics, getEmployeeDetail } = require('../services/analyticsService');
const { answerQuestion } = require('../services/aiAssistantService');

const router = express.Router();

function parseCsvText(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const splitLine = (line) => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = splitLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = vals[i] ?? '';
    });
    return obj;
  });
}

router.get('/health', async (req, res, next) => {
  try {
    const repo = getRepository();
    const meta = await repo.getShopAndMeta();
    res.json({
      status: 'ok',
      service: 'Rewardly API',
      backend: getBackendStatus(),
      counts: meta.counts,
      dateBounds: meta.dateBounds,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/meta', async (req, res, next) => {
  try {
    const repo = getRepository();
    const [meta, departments, settings] = await Promise.all([
      repo.getShopAndMeta(),
      repo.getDepartments(),
      repo.getSettings(),
    ]);
    res.json({
      ...meta,
      departments,
      settings,
      backend: getBackendStatus(),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const { startDate, endDate, department = 'all' } = req.query;
    const data = await getDashboardAnalytics({ startDate, endDate, departmentCode: department });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/employees', async (req, res, next) => {
  try {
    const { startDate, endDate, department = 'all' } = req.query;
    const data = await getDashboardAnalytics({ startDate, endDate, departmentCode: department });
    res.json({
      range: data.meta.activeRange,
      employees: data.employeesRanked,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/employees/:id', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const detail = await getEmployeeDetail(req.params.id, { startDate, endDate });
    if (!detail) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

router.post('/employees', async (req, res, next) => {
  try {
    const repo = getRepository();
    const created = await repo.createEmployee(req.body || {});
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.put('/employees/:id', async (req, res, next) => {
  try {
    const repo = getRepository();
    const updated = await repo.updateEmployee(req.params.id, req.body || {});
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/employees/:id', async (req, res, next) => {
  try {
    const repo = getRepository();
    const result = await repo.deleteEmployee(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/employees/:id/avatar', async (req, res, next) => {
  try {
    const { avatar_url } = req.body || {};
    const repo = getRepository();
    const updated = await repo.updateEmployeeAvatar(req.params.id, avatar_url);
    res.json({ success: true, employee: updated });
  } catch (err) {
    next(err);
  }
});

// Employee Auth Routes (Username is Employee ID only)
router.post('/auth/employee-login', async (req, res, next) => {
  try {
    const { emp_code, password } = req.body || {};
    if (!emp_code || !password) {
      return res.status(400).json({ error: 'Employee ID and password are required.' });
    }
    const repo = getRepository();
    const result = await repo.authenticateEmployee(emp_code, password);
    res.json({
      success: true,
      token: result.token,
      employee: result.employee,
      isDefaultPassword: Boolean(result.isDefaultPassword),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/employee-reset-password', async (req, res, next) => {
  try {
    const { emp_code, verification, new_password } = req.body || {};
    if (!emp_code || !verification || !new_password) {
      return res.status(400).json({ error: 'Employee ID, verification details (email or phone), and new password are required.' });
    }
    if (String(new_password).length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters.' });
    }
    const repo = getRepository();
    const result = await repo.resetEmployeePassword(emp_code, verification, new_password);
    res.json({
      success: true,
      message: 'Password reset successfully.',
      employee: result.employee,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/departments', async (req, res, next) => {
  try {
    const repo = getRepository();
    const departments = await repo.getDepartments();
    res.json({ departments });
  } catch (err) {
    next(err);
  }
});

router.post('/departments', async (req, res, next) => {
  try {
    const repo = getRepository();
    const created = await repo.createDepartment(req.body || {});
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.put('/departments/:id', async (req, res, next) => {
  try {
    const repo = getRepository();
    const updated = await repo.updateDepartment(req.params.id, req.body || {});
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/departments/:id', async (req, res, next) => {
  try {
    const repo = getRepository();
    const result = await repo.deleteDepartment(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/recognitions', async (req, res, next) => {
  try {
    const { employee_id, given_by_name, recognition_type, badge_title, points, message, recognition_date } = req.body || {};
    if (!employee_id || !message) {
      return res.status(400).json({ error: 'employee_id and message are required.' });
    }
    const repo = getRepository();
    const created = await repo.createRecognition({
      employee_id,
      given_by_name: given_by_name || 'Rajeshwari Deshpande',
      recognition_type: recognition_type || 'Manager',
      badge_title: badge_title || 'Star Showroom Performer',
      points: Number(points) || 30,
      message,
      recognition_date,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.patch('/rewards/:id', async (req, res, next) => {
  try {
    const { status, reviewedBy } = req.body || {};
    if (!['Approved', 'Dismissed', 'Pending'].includes(status)) {
      return res.status(400).json({ error: 'status must be Approved, Dismissed, or Pending.' });
    }
    const repo = getRepository();
    const updated = await repo.updateRewardRecommendation(req.params.id, {
      status,
      reviewedBy: reviewedBy || 'Rajeshwari Deshpande',
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/import/sales', async (req, res, next) => {
  try {
    const { csvText, rows } = req.body || {};
    const parsedRows = Array.isArray(rows) ? rows : parseCsvText(csvText);
    if (!parsedRows.length) {
      return res.status(400).json({ error: 'No valid sales rows found in payload.' });
    }
    const repo = getRepository();
    const result = await repo.insertSalesRows(parsedRows);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/ai/query', async (req, res, next) => {
  try {
    const { question, startDate, endDate, department = 'all', chartType = 'auto' } = req.body || {};
    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: 'question is required.' });
    }
    const result = await answerQuestion({
      question,
      startDate,
      endDate,
      departmentCode: department,
      preferredChartType: chartType,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/settings', async (req, res, next) => {
  try {
    const repo = getRepository();
    const [meta, settings, departments, employees] = await Promise.all([
      repo.getShopAndMeta(),
      repo.getSettings(),
      repo.getDepartments(),
      repo.getEmployees(),
    ]);
    res.json({
      shop: meta.shop,
      dateBounds: meta.dateBounds,
      counts: meta.counts,
      settings,
      departments,
      employees,
      backend: getBackendStatus(),
    });
  } catch (err) {
    next(err);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const { shop: shopPatch, settings: settingsPatch } = req.body || {};
    const repo = getRepository();

    let updatedShop = null;
    let updatedSettings = null;

    if (settingsPatch) {
      const sum =
        Number(settingsPatch.sales_weight ?? 40) +
        Number(settingsPatch.attendance_weight ?? 25) +
        Number(settingsPatch.feedback_weight ?? 20) +
        Number(settingsPatch.recognition_weight ?? 15);
      if (sum <= 0) {
        return res.status(400).json({ error: 'Weight sum must be greater than 0.' });
      }
      updatedSettings = await repo.updateSettings(settingsPatch);
    } else {
      updatedSettings = await repo.getSettings();
    }

    if (shopPatch) {
      updatedShop = await repo.updateShop(shopPatch);
    } else {
      updatedShop = (await repo.getShopAndMeta()).shop;
    }

    res.json({ shop: updatedShop, settings: updatedSettings });
  } catch (err) {
    next(err);
  }
});

router.post('/settings/test-supabase', async (req, res) => {
  const { url, key } = req.body || {};
  const result = await testSupabaseConnection({ url, key });
  res.json(result);
});

router.post('/settings/reset-seed', async (req, res, next) => {
  try {
    const repo = getRepository();
    const result = await repo.resetAndReseed();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/supabase/schema', (req, res, next) => {
  try {
    const schemaPath = path.resolve(__dirname, '..', '..', 'supabase', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    res.type('text/plain').send(sql);
  } catch (err) {
    next(err);
  }
});

router.get('/public/feedback-target/:empRef', async (req, res, next) => {
  try {
    const repo = getRepository();
    const target = await repo.getEmployeePublicTarget(req.params.empRef);
    res.json(target);
  } catch (err) {
    next(err);
  }
});

router.post('/public/feedback', async (req, res, next) => {
  try {
    const repo = getRepository();
    const created = await repo.createPublicFeedback(req.body || {});
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// Billing & POS Counter Routes
const TEXTILE_CATALOG = [
  { id: 'cat_01', name: 'Pure Kanjeevaram Bridal Silk Saree', dept_code: 'SILK', dept_name: 'Silk & Sarees', price_inr: 18500, sku: 'SILK-KAN-01', tax_pct: 5 },
  { id: 'cat_02', name: 'Banarasi Brocade Silk Saree with Zari', dept_code: 'SILK', dept_name: 'Silk & Sarees', price_inr: 14200, sku: 'SILK-BAN-02', tax_pct: 5 },
  { id: 'cat_03', name: 'Mysore Crepe Silk Handloom Saree', dept_code: 'SILK', dept_name: 'Silk & Sarees', price_inr: 8900, sku: 'SILK-MYS-03', tax_pct: 5 },
  { id: 'cat_04', name: 'Tussar Handwoven Silk with Blouse', dept_code: 'SILK', dept_name: 'Silk & Sarees', price_inr: 6400, sku: 'SILK-TUS-04', tax_pct: 5 },
  { id: 'cat_05', name: 'Hand-Embroidered Velvet Bridal Lehenga', dept_code: 'ETHN', dept_name: 'Ethnic & Bridal', price_inr: 32000, sku: 'ETH-LEH-01', tax_pct: 5 },
  { id: 'cat_06', name: 'Raw Silk Sherwani with Stole & Churidar', dept_code: 'ETHN', dept_name: 'Ethnic & Bridal', price_inr: 22500, sku: 'ETH-SHW-02', tax_pct: 5 },
  { id: 'cat_07', name: 'Festive Georgette Anarkali Suit Set', dept_code: 'ETHN', dept_name: 'Ethnic & Bridal', price_inr: 7800, sku: 'ETH-ANK-03', tax_pct: 5 },
  { id: 'cat_08', name: 'Italian Wool Blend 2-Piece Suit Length', dept_code: 'MENS', dept_name: 'Menswear & Formals', price_inr: 11500, sku: 'MEN-SUT-01', tax_pct: 5 },
  { id: 'cat_09', name: 'Pure Silk Dhoti with Gold Angavastram', dept_code: 'MENS', dept_name: 'Menswear & Formals', price_inr: 3800, sku: 'MEN-DHO-02', tax_pct: 5 },
  { id: 'cat_10', name: 'Premium Cotton Jacquard Kurta Set', dept_code: 'MENS', dept_name: 'Menswear & Formals', price_inr: 3200, sku: 'MEN-KUR-03', tax_pct: 5 },
  { id: 'cat_11', name: 'Kids Traditional Pattu Pavada Set', dept_code: 'KIDS', dept_name: 'Kids & Casuals', price_inr: 2600, sku: 'KID-PAT-01', tax_pct: 5 },
  { id: 'cat_12', name: 'Boys Silk Kurta Pyjama with Waistcoat', dept_code: 'KIDS', dept_name: 'Kids & Casuals', price_inr: 2200, sku: 'KID-KUR-02', tax_pct: 5 },
  { id: 'cat_13', name: 'Pure Cotton Jacquard Double Bedspread Set', dept_code: 'HOME', dept_name: 'Home & Linen', price_inr: 3400, sku: 'HOM-BED-01', tax_pct: 5 },
  { id: 'cat_14', name: 'Handcrafted Banarasi Cushion Covers (Set of 5)', dept_code: 'HOME', dept_name: 'Home & Linen', price_inr: 1800, sku: 'HOM-CSH-02', tax_pct: 5 },
];

router.get('/billing/init', async (req, res, next) => {
  try {
    const repo = getRepository();
    const [{ shop }, departments, employees] = await Promise.all([
      repo.getShopAndMeta(),
      repo.getDepartments(),
      repo.getEmployees(),
    ]);

    // Active sales staff for attribution
    const salesStaff = employees.filter((e) => e.status !== 'inactive');

    res.json({
      shop: {
        name: shop?.name || 'Kaveri Silks & Textiles',
        tagline: shop?.tagline || 'Flagship Textile Showroom',
        location: shop?.location || 'Commercial Street & Jayanagar Flagship, Bengaluru',
        currency: 'INR',
        gstin: '29AABCK1234F1Z5',
        tax_rate_pct: 5,
      },
      counter: {
        id: 'POS-KVR-01',
        name: 'Counter #1 (Main Silk Floor)',
        terminal_code: 'TERM-01',
      },
      departments,
      catalog: TEXTILE_CATALOG,
      salesStaff: salesStaff.map((s) => ({
        id: s.id,
        emp_code: s.emp_code,
        full_name: s.full_name,
        role: s.role,
        role_category: s.role_category,
        department_name: s.department_name,
        avatar_url: s.avatar_url,
        avatar_color: s.avatar_color,
        avatar_initials: s.avatar_initials,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/billing/create-invoice', async (req, res, next) => {
  try {
    const repo = getRepository();
    const result = await repo.createBillingInvoice(req.body || {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

