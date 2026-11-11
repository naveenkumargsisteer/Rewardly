const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function computeInitials(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function normalizeHexColor(value, fallback = '#7C3AED') {
  const s = String(value || '').trim();
  if (HEX_COLOR_RE.test(s)) return s;
  return fallback;
}

function normalizeDeptCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function sanitizeDepartmentPayload(body = {}, { isUpdate = false } = {}) {
  const out = {};

  if (!isUpdate || body.code !== undefined) {
    const code = normalizeDeptCode(body.code);
    if (!code || !/^[A-Z0-9_-]{2,32}$/.test(code)) {
      throw httpError(400, 'Department code must be 2–32 characters (letters, numbers, _ or -).');
    }
    out.code = code;
  }

  if (!isUpdate || body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name) {
      throw httpError(400, 'Department name is required.');
    }
    out.name = name;
  }

  if (!isUpdate || body.target_monthly_sales !== undefined) {
    const raw = body.target_monthly_sales ?? 1000000;
    const target = Number(raw);
    if (!Number.isFinite(target) || target < 0) {
      throw httpError(400, 'Monthly sales target must be a valid non-negative number.');
    }
    out.target_monthly_sales = Math.round(target * 100) / 100;
  }

  if (!isUpdate || body.color_hex !== undefined) {
    out.color_hex = normalizeHexColor(body.color_hex, '#7C3AED');
  }

  return out;
}

function sanitizeEmployeePayload(body = {}, { isUpdate = false, fallbackColor = '#7C3AED' } = {}) {
  const out = {};

  if (!isUpdate || body.department_id !== undefined) {
    const deptId = String(body.department_id || '').trim();
    if (!deptId) {
      throw httpError(400, 'Department is required.');
    }
    out.department_id = deptId;
  }

  if (!isUpdate || body.emp_code !== undefined) {
    const empCode = String(body.emp_code || '').trim().toUpperCase().replace(/\s+/g, '-');
    if (!empCode || !/^[A-Z0-9_-]{2,24}$/.test(empCode)) {
      throw httpError(400, 'Employee code must be 2–24 characters (e.g. KVR-031).');
    }
    out.emp_code = empCode;
  }

  if (!isUpdate || body.full_name !== undefined) {
    const fullName = String(body.full_name || '').trim();
    if (!fullName) {
      throw httpError(400, 'Employee full name is required.');
    }
    out.full_name = fullName;
  }

  if (!isUpdate || body.email !== undefined) {
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      throw httpError(400, 'Valid employee email address is required.');
    }
    out.email = email;
  }

  if (!isUpdate || body.phone !== undefined) {
    const phone = String(body.phone ?? '').trim();
    out.phone = phone || null;
  }

  if (!isUpdate || body.gender !== undefined) {
    const gender = String(body.gender ?? '').trim();
    out.gender = gender || 'Female';
  }

  if (!isUpdate || body.role !== undefined) {
    const role = String(body.role || '').trim();
    if (!role) {
      throw httpError(400, 'Employee role is required.');
    }
    out.role = role;
  }

  if (!isUpdate || body.shift !== undefined) {
    const shift = String(body.shift ?? '').trim();
    out.shift = shift || 'Morning (10:00-19:30)';
  }

  if (!isUpdate || body.join_date !== undefined) {
    const joinDate = String(body.join_date || new Date().toISOString().slice(0, 10)).trim();
    if (!ISO_DATE_RE.test(joinDate)) {
      throw httpError(400, 'Join date must be in YYYY-MM-DD format.');
    }
    out.join_date = joinDate;
  }

  if (!isUpdate || body.base_salary_inr !== undefined) {
    const salary = Number(body.base_salary_inr ?? 25000);
    if (!Number.isFinite(salary) || salary < 0) {
      throw httpError(400, 'Base salary must be a valid non-negative number.');
    }
    out.base_salary_inr = Math.round(salary * 100) / 100;
  }

  if (body.avatar_initials !== undefined && String(body.avatar_initials).trim()) {
    out.avatar_initials = String(body.avatar_initials).trim().toUpperCase().slice(0, 3);
  } else if (!isUpdate || out.full_name !== undefined) {
    out.avatar_initials = computeInitials(out.full_name);
  }

  if (body.avatar_color !== undefined || !isUpdate) {
    out.avatar_color = normalizeHexColor(body.avatar_color, fallbackColor);
  }

  if (!isUpdate || body.status !== undefined) {
    const status = String(body.status || 'active').trim().toLowerCase();
    if (!['active', 'inactive'].includes(status)) {
      throw httpError(400, 'Status must be "active" or "inactive".');
    }
    out.status = status;
  }

  return out;
}

module.exports = {
  httpError,
  computeInitials,
  sanitizeDepartmentPayload,
  sanitizeEmployeePayload,
};

