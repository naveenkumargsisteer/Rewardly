const express = require('express');
const { getRepository } = require('../db');
const { getFullExportPayload } = require('../services/analyticsService');

const router = express.Router();

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function csvEscape(val) {
  const s = val === null || val === undefined ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function employeesToCsv(payload) {
  const headers = [
    'Rank', 'EmpCode', 'FullName', 'Department', 'Role', 'NetSalesINR', 'TargetINR',
    'TargetPct', 'Bills', 'PresentDays', 'LateDays', 'LeaveDays', 'AttendanceScore',
    'AvgRating', 'FeedbackCount', 'Recognitions', 'RecognitionPoints', 'CompositeScore', 'Tier',
  ];
  const rows = (payload.employees || []).map((e) => [
    e.rank,
    e.emp_code,
    e.full_name,
    e.department_name,
    e.role,
    e.metrics.netSalesInr,
    e.metrics.proRatedTargetInr,
    e.metrics.targetAchievementPct,
    e.metrics.billsCount,
    e.metrics.presentDays,
    e.metrics.lateDays,
    e.metrics.leaveDays,
    e.scores.attendanceScore,
    e.metrics.avgRating,
    e.metrics.feedbackCount,
    e.metrics.recognitionCount,
    e.metrics.recognitionPoints,
    e.scores.compositeScore,
    e.scores.tier,
  ]);

  return [headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
}

async function handlePublicExport(req, res, next) {
  try {
    const repo = getRepository();
    const settings = await repo.getSettings();

    if (settings.require_export_token) {
      const provided = req.query.apiKey || req.headers['x-api-key'];
      if (!provided || provided !== settings.public_export_token) {
        return res.status(401).json({
          error: 'Unauthorized: valid apiKey query parameter or x-api-key header is required.',
        });
      }
    }

    const { startDate, endDate, department = 'all', include = 'all', format = 'json' } = req.query;

    if (startDate && !ISO_DATE_RE.test(startDate)) {
      return res.status(400).json({ error: 'Invalid startDate. Expected YYYY-MM-DD.' });
    }
    if (endDate && !ISO_DATE_RE.test(endDate)) {
      return res.status(400).json({ error: 'Invalid endDate. Expected YYYY-MM-DD.' });
    }
    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({ error: 'startDate cannot be after endDate.' });
    }

    const payload = await getFullExportPayload({
      startDate,
      endDate,
      departmentCode: department,
      include,
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    if (String(format).toLowerCase() === 'csv') {
      const csv = employeesToCsv(payload);
      const fname = `rewardly-export-${payload.meta.filter.startDate}-to-${payload.meta.filter.endDate}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${fname}"`);
      return res.send(csv);
    }

    return res.json(payload);
  } catch (err) {
    return next(err);
  }
}

router.get('/public/export', handlePublicExport);
router.get('/v1/export/all', handlePublicExport);

module.exports = router;

