const crypto = require('node:crypto');

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(String(pwd).trim()).digest('hex');
}

function parsePhoneAndAuth(rawPhone) {
  const str = String(rawPhone || '');
  if (!str.includes('###auth:')) {
    return { phone: str.trim(), passwordHash: null };
  }
  const [phone, authPart] = str.split('###auth:');
  const [hash] = (authPart || '').split('###');
  return { phone: phone.trim(), passwordHash: hash || null };
}

function packPhoneAndAuth(phone, passwordHash) {
  const basePhone = String(phone || '').split('###')[0].trim();
  if (!passwordHash) return basePhone;
  return `${basePhone}###auth:${passwordHash}`;
}

function getRoleCategory(role, empCode = '') {
  const code = String(empCode || '').trim().toUpperCase();
  if (code === 'ADMIN01' || code === 'ADMIN') return 'admin';
  if (code === 'CASH01' || code === 'CASHIER') return 'cashier';
  if (code === 'STAFF01' || code === 'STAFF') return 'staff';

  const r = String(role || '').toLowerCase();
  if (
    r.includes('floor manager') ||
    r.includes('admin') ||
    r.includes('owner') ||
    r.includes('store manager') ||
    r.includes('assistant manager') ||
    r.includes('floor lead')
  ) {
    return 'admin';
  }
  if (
    r.includes('cashier') ||
    r.includes('billing') ||
    r.includes('pos') ||
    r.includes('cash desk')
  ) {
    return 'cashier';
  }
  return 'staff';
}

function isPasswordValid(inputPassword, storedHash, empCode = '') {
  const pwd = String(inputPassword || '').trim();
  const code = String(empCode || '').trim().toUpperCase();

  // If a custom hash is stored, check it first
  if (storedHash && hashPassword(pwd) === storedHash) {
    return true;
  }

  // Standard accepted defaults for testing and initial access
  const accepted = [
    code,
    code.toLowerCase(),
    'Rewardly@123',
  ];

  if (code === 'ADMIN01' || code === 'RW012') {
    accepted.push('Admin@123', 'admin@123', 'admin', 'ADMIN01', 'admin01');
  } else if (code === 'CASH01' || code === 'RW028' || code === 'RW026') {
    accepted.push('Cashier@123', 'cashier@123', 'cashier', 'CASH01', 'cash01');
  } else if (code === 'STAFF01' || code === 'RW002' || code === 'RW003') {
    accepted.push('Staff@123', 'staff@123', 'staff', 'STAFF01', 'staff01');
  }

  return accepted.includes(pwd);
}

function parseStaffTargets(aiProviderStr) {
  const str = String(aiProviderStr || '');
  if (!str.includes('###staff_targets:')) {
    return {};
  }
  try {
    const raw = str.split('###staff_targets:')[1].split('###')[0];
    return JSON.parse(raw) || {};
  } catch (e) {
    return {};
  }
}

function parseDeptPeriods(aiProviderStr) {
  const str = String(aiProviderStr || '');
  if (!str.includes('###dept_periods:')) {
    return {};
  }
  try {
    const raw = str.split('###dept_periods:')[1].split('###')[0];
    return JSON.parse(raw) || {};
  } catch (e) {
    return {};
  }
}

function parseBillingConfig(aiProviderStr) {
  const str = String(aiProviderStr || '');
  if (!str.includes('###billing_config:')) {
    return { use_internal_billing: true };
  }
  try {
    const raw = str.split('###billing_config:')[1].split('###')[0];
    const parsed = JSON.parse(raw);
    return {
      use_internal_billing: parsed?.use_internal_billing !== false,
      ...parsed,
    };
  } catch (e) {
    return { use_internal_billing: true };
  }
}

function parseAttachedBills(aiProviderStr) {
  const str = String(aiProviderStr || '');
  if (!str.includes('###attached_bills:')) {
    return {};
  }
  try {
    const raw = str.split('###attached_bills:')[1].split('###')[0];
    return JSON.parse(raw) || {};
  } catch (e) {
    return {};
  }
}

function packAllMeta(aiProviderStr, { staffTargets, deptPeriods, billingConfig, attachedBills } = {}) {
  const str = String(aiProviderStr || 'builtin');
  const existingStaff = staffTargets !== undefined ? staffTargets : parseStaffTargets(str);
  const existingDepts = deptPeriods !== undefined ? deptPeriods : parseDeptPeriods(str);
  const existingBilling = billingConfig !== undefined ? billingConfig : parseBillingConfig(str);
  const existingBills = attachedBills !== undefined ? attachedBills : parseAttachedBills(str);

  const baseProvider = str.split('###')[0].trim() || 'builtin';
  let result = baseProvider;
  if (Object.keys(existingStaff).length > 0) {
    result += `###staff_targets:${JSON.stringify(existingStaff)}`;
  }
  if (Object.keys(existingDepts).length > 0) {
    result += `###dept_periods:${JSON.stringify(existingDepts)}`;
  }
  if (existingBilling && typeof existingBilling === 'object') {
    result += `###billing_config:${JSON.stringify(existingBilling)}`;
  }
  if (Object.keys(existingBills).length > 0) {
    result += `###attached_bills:${JSON.stringify(existingBills)}`;
  }
  return result;
}

function packStaffTargets(aiProviderStr, newTargetsMap = {}) {
  const str = String(aiProviderStr || 'builtin');
  const existingMap = parseStaffTargets(str);
  const merged = { ...existingMap };
  for (const [k, v] of Object.entries(newTargetsMap)) {
    if (v == null || v === '') {
      delete merged[k];
    } else {
      const num = Number(v);
      if (!isNaN(num) && num >= 0) {
        merged[k] = Math.round(num);
      }
    }
  }
  return packAllMeta(str, { staffTargets: merged });
}

function packDeptPeriods(aiProviderStr, newPeriodsMap = {}) {
  const str = String(aiProviderStr || 'builtin');
  const existingPeriods = parseDeptPeriods(str);
  const merged = { ...existingPeriods, ...newPeriodsMap };
  return packAllMeta(str, { deptPeriods: merged });
}

function packBillingConfig(aiProviderStr, newConfig = {}) {
  const str = String(aiProviderStr || 'builtin');
  const current = parseBillingConfig(str);
  const merged = { ...current, ...newConfig };
  return packAllMeta(str, { billingConfig: merged });
}

function packAttachedBills(aiProviderStr, newBillsMap = {}) {
  const str = String(aiProviderStr || 'builtin');
  const current = parseAttachedBills(str);
  const merged = { ...current, ...newBillsMap };
  return packAllMeta(str, { attachedBills: merged });
}

module.exports = {
  hashPassword,
  parsePhoneAndAuth,
  packPhoneAndAuth,
  getRoleCategory,
  isPasswordValid,
  parseStaffTargets,
  packStaffTargets,
  parseDeptPeriods,
  packDeptPeriods,
  parseBillingConfig,
  packBillingConfig,
  parseAttachedBills,
  packAttachedBills,
};

