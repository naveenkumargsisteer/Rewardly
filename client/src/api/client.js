async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  getMeta: () => request('/api/meta'),
  getDashboard: ({ startDate, endDate, department }) => {
    const p = new URLSearchParams();
    if (startDate) p.set('startDate', startDate);
    if (endDate) p.set('endDate', endDate);
    if (department) p.set('department', department);
    return request(`/api/dashboard?${p.toString()}`);
  },
  getEmployeeDetail: (id, { startDate, endDate }) => {
    const p = new URLSearchParams();
    if (startDate) p.set('startDate', startDate);
    if (endDate) p.set('endDate', endDate);
    return request(`/api/employees/${encodeURIComponent(id)}?${p.toString()}`);
  },
  createRecognition: (payload) =>
    request('/api/recognitions', { method: 'POST', body: JSON.stringify(payload) }),
  updateRewardStatus: (id, status) =>
    request(`/api/rewards/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  importSalesCsv: (csvText) =>
    request('/api/import/sales', { method: 'POST', body: JSON.stringify({ csvText }) }),
  queryAi: (payload) =>
    request('/api/ai/query', { method: 'POST', body: JSON.stringify(payload) }),
  getSettings: () => request('/api/settings'),
  updateSettings: (payload) =>
    request('/api/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  createEmployee: (payload) =>
    request('/api/employees', { method: 'POST', body: JSON.stringify(payload) }),
  updateEmployee: (id, payload) =>
    request(`/api/employees/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteEmployee: (id) =>
    request(`/api/employees/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getDepartments: () => request('/api/departments'),
  createDepartment: (payload) =>
    request('/api/departments', { method: 'POST', body: JSON.stringify(payload) }),
  updateDepartment: (id, payload) =>
    request(`/api/departments/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteDepartment: (id) =>
    request(`/api/departments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  testSupabase: (payload) =>
    request('/api/settings/test-supabase', { method: 'POST', body: JSON.stringify(payload) }),
  resetSeed: () => request('/api/settings/reset-seed', { method: 'POST' }),
  getSupabaseSchema: async () => {
    const res = await fetch('/api/supabase/schema');
    if (!res.ok) throw new Error('Could not load schema');
    return res.text();
  },
};

export function formatInr(amount) {
  return `₹${Math.round(Number(amount || 0)).toLocaleString('en-IN')}`;
}

export function formatCompactInr(amount) {
  const n = Number(amount || 0);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

