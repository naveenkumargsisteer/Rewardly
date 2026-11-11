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

module.exports = router;

