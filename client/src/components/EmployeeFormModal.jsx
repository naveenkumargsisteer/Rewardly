import React, { useEffect, useState } from 'react';
import { X, UserPlus, UserCheck } from 'lucide-react';
import { api } from '../api/client';

const SHIFT_PRESETS = [
  'Morning (10:00-19:30)',
  'Mid-Shift (11:30-21:00)',
  'Evening (12:30-21:30)',
  'General (10:30-20:00)',
];

const INITIAL_FORM = {
  emp_code: '',
  full_name: '',
  email: '',
  phone: '',
  department_id: '',
  role: 'Sales Executive',
  shift: SHIFT_PRESETS[0],
  gender: 'Female',
  join_date: '',
  base_salary_inr: '25000',
  status: 'active',
  avatar_color: '#7C3AED',
};

export default function EmployeeFormModal({
  isOpen,
  initialEmployee,
  departments,
  suggestedCode,
  onClose,
  onSaved,
}) {
  const isEdit = Boolean(initialEmployee);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    if (initialEmployee) {
      setForm({
        emp_code: initialEmployee.emp_code || '',
        full_name: initialEmployee.full_name || '',
        email: initialEmployee.email || '',
        phone: initialEmployee.phone || '',
        department_id: initialEmployee.department_id || departments?.[0]?.id || '',
        role: initialEmployee.role || '',
        shift: initialEmployee.shift || SHIFT_PRESETS[0],
        gender: initialEmployee.gender || 'Female',
        join_date: String(initialEmployee.join_date || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
        base_salary_inr: String(initialEmployee.base_salary_inr ?? 25000),
        status: initialEmployee.status || 'active',
        avatar_color: initialEmployee.avatar_color || '#7C3AED',
      });
    } else {
      const defaultDept = departments?.[0];
      setForm({
        ...INITIAL_FORM,
        emp_code: suggestedCode || '',
        department_id: defaultDept?.id || '',
        join_date: new Date().toISOString().slice(0, 10),
        avatar_color: defaultDept?.color_hex || '#7C3AED',
      });
    }
  }, [isOpen, initialEmployee, departments, suggestedCode]);

  if (!isOpen) return null;

  const shiftOptions = form.shift && !SHIFT_PRESETS.includes(form.shift)
    ? [form.shift, ...SHIFT_PRESETS]
    : SHIFT_PRESETS;

  function handleDeptChange(nextDeptId) {
    const dept = (departments || []).find((d) => d.id === nextDeptId);
    setForm((prev) => ({
      ...prev,
      department_id: nextDeptId,
      avatar_color: !isEdit && dept?.color_hex ? dept.color_hex : prev.avatar_color,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        emp_code: form.emp_code.trim().toUpperCase(),
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role.trim(),
        base_salary_inr: Number(form.base_salary_inr),
      };
      const saved = isEdit
        ? await api.updateEmployee(initialEmployee.id, payload)
        : await api.createEmployee(payload);
      onSaved(saved, isEdit);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card narrow" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isEdit ? <UserCheck size={18} color="#6d28d9" /> : <UserPlus size={18} color="#6d28d9" />}
            <strong style={{ fontSize: 16 }}>
              {isEdit ? `Edit Employee (${initialEmployee.emp_code})` : 'Add New Employee'}
            </strong>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {errorMsg && (
            <div
              role="alert"
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: 13,
              }}
            >
              {errorMsg}
            </div>
          )}

          <div className="form-grid">
            <div className="field">
              <label className="field-label">Employee Code *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. KVR-031"
                value={form.emp_code}
                onChange={(e) => setForm({ ...form, emp_code: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="field">
              <label className="field-label">Full Name *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Meenakshi Iyer"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </div>

            <div className="field">
              <label className="field-label">Email Address *</label>
              <input
                type="email"
                className="input"
                placeholder="name@kaverisilks.in"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="field">
              <label className="field-label">Phone Number</label>
              <input
                type="text"
                className="input"
                placeholder="+91 98450 00000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div className="field">
              <label className="field-label">Department *</label>
              <select
                className="select"
                value={form.department_id}
                onChange={(e) => handleDeptChange(e.target.value)}
                required
              >
                <option value="" disabled>Select department...</option>
                {(departments || []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label">Role / Designation *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Senior Sales Executive"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                required
              />
            </div>

            <div className="field">
              <label className="field-label">Shift</label>
              <select
                className="select"
                value={form.shift}
                onChange={(e) => setForm({ ...form, shift: e.target.value })}
              >
                {shiftOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label">Gender</label>
              <select
                className="select"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="field">
              <label className="field-label">Join Date *</label>
              <input
                type="date"
                className="input"
                value={form.join_date}
                onChange={(e) => setForm({ ...form, join_date: e.target.value })}
                required
              />
            </div>

            <div className="field">
              <label className="field-label">Monthly Base Salary (₹) *</label>
              <input
                type="number"
                className="input"
                min={0}
                step="500"
                value={form.base_salary_inr}
                onChange={(e) => setForm({ ...form, base_salary_inr: e.target.value })}
                required
              />
            </div>

            <div className="field">
              <label className="field-label">Status</label>
              <select
                className="select"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="field">
              <label className="field-label">Avatar Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38 }}>
                <input
                  type="color"
                  value={form.avatar_color}
                  onChange={(e) => setForm({ ...form, avatar_color: e.target.value })}
                  style={{ width: 40, height: 34, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                />
                <code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{form.avatar_color}</code>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !departments?.length}>
              {submitting ? 'Saving...' : isEdit ? 'Save Employee' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

