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
  getPublicFeedbackTarget: (empRef) =>
    request(`/api/public/feedback-target/${encodeURIComponent(empRef)}`),
  submitPublicFeedback: (payload) =>
    request('/api/public/feedback', { method: 'POST', body: JSON.stringify(payload) }),
  employeeLogin: ({ emp_code, password }) =>
    request('/api/auth/employee-login', {
      method: 'POST',
      body: JSON.stringify({ emp_code, password }),
    }),
  employeeResetPassword: ({ emp_code, verification, new_password }) =>
    request('/api/auth/employee-reset-password', {
      method: 'POST',
      body: JSON.stringify({ emp_code, verification, new_password }),
    }),
  updateEmployeeAvatar: (id, avatar_url) =>
    request(`/api/employees/${encodeURIComponent(id)}/avatar`, {
      method: 'PUT',
      body: JSON.stringify({ avatar_url }),
    }),
};

/**
 * Client-side minimal resolution image compressor for avatars.
 * Centers, crops to a square, resizes to target size (default 160x160),
 * and compresses to WebP/JPEG.
 * Keeps payload ~6-12KB for zero storage burden on Supabase & Vercel.
 */
export async function compressImageToMinimalResolution(file, { maxSize = 160, quality = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Please select a valid image file.'));
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      canvas.width = maxSize;
      canvas.height = maxSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Canvas 2D context unavailable'));
      }

      // Smooth resizing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Center square crop
      const w = img.width;
      const h = img.height;
      const cropSize = Math.min(w, h);
      const srcX = (w - cropSize) / 2;
      const srcY = (h - cropSize) / 2;

      ctx.drawImage(img, srcX, srcY, cropSize, cropSize, 0, 0, maxSize, maxSize);

      // Prefer image/webp for ultra-low bytes, fallback to image/jpeg
      let dataUrl = canvas.toDataURL('image/webp', quality);
      if (!dataUrl.startsWith('data:image/webp')) {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      // Approx size in bytes from base64 length
      const approxBytes = Math.round((dataUrl.length * 3) / 4);

      resolve({
        dataUrl,
        sizeBytes: approxBytes,
        sizeKb: (approxBytes / 1024).toFixed(1),
        width: maxSize,
        height: maxSize,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load and process image.'));
    };

    img.src = objectUrl;
  });
}

export function formatInr(amount) {
  return `₹${Math.round(Number(amount || 0)).toLocaleString('en-IN')}`;
}

export function formatCompactInr(amount) {
  const n = Number(amount || 0);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).trim().slice(0, 10);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, y, m, d] = match;
    return `${d}-${m}-${y}`;
  }
  return str;
}

