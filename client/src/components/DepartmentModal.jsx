import React, { useEffect, useState } from 'react';
import { Building2, Pencil, Trash2, X } from 'lucide-react';
import { api, formatInr } from '../api/client';

const COLOR_PRESETS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DB2777', '#0891B2'];

export default function DepartmentModal({
  isOpen,
  initialDepartment,
  assignedStaffCount = 0,
  mode = 'details', // 'details' | 'edit'
  onClose,
  onSaved,
  onDelete,
}) {
  const isExisting = Boolean(initialDepartment);
  const [viewMode, setViewMode] = useState(mode);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [targetMonthlySales, setTargetMonthlySales] = useState('1000000');
  const [colorHex, setColorHex] = useState('#7C3AED');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    if (initialDepartment) {
      setViewMode(mode || 'details');
      setCode(initialDepartment.code || '');
      setName(initialDepartment.name || '');
      setTargetMonthlySales(String(initialDepartment.target_monthly_sales ?? 1000000));
      setColorHex(initialDepartment.color_hex || '#7C3AED');
    } else {
      setViewMode('edit');
      setCode('');
      setName('');
      setTargetMonthlySales('1000000');
      setColorHex('#7C3AED');
    }
  }, [isOpen, initialDepartment, mode]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        target_monthly_sales: Number(targetMonthlySales),
        color_hex: colorHex,
      };
      const saved = isExisting
        ? await api.updateDepartment(initialDepartment.id, payload)
        : await api.createDepartment(payload);
      onSaved(saved, isExisting);
      if (isExisting) {
        setViewMode('details');
      } else {
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card narrow" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header with Top Action Buttons */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Building2 size={18} color="#6d28d9" style={{ flexShrink: 0 }} />
            <strong style={{ fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {viewMode === 'details'
                ? `Department Details — ${name} (${code})`
                : isExisting
                  ? `Edit Department (${code})`
                  : 'Add New Department'}
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {viewMode === 'details' && isExisting && (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setViewMode('edit')}
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => onDelete?.(initialDepartment)}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close modal">
              <X size={18} />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            style={{
              margin: '12px 20px 0',
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

        {/* ---------------- READ-ONLY DETAILS VIEW ---------------- */}
        {viewMode === 'details' && (
          <div className="modal-body">
            {/* Department banner */}
            <div className="emp-profile-banner">
              <div className="emp-profile-left">
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: colorHex || '#7C3AED',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    Showroom Textile Department
                  </div>
                </div>
              </div>
              <span className="brand-badge" style={{ fontSize: 12 }}>
                {code}
              </span>
            </div>

            {/* Read-only Key-Value Fields Grid */}
            <div className="emp-details-grid">
              <div className="emp-detail-item">
                <span className="emp-detail-label">Department Code</span>
                <strong className="emp-detail-value">{code}</strong>
              </div>

              <div className="emp-detail-item">
                <span className="emp-detail-label">Department Name</span>
                <strong className="emp-detail-value">{name}</strong>
              </div>

              <div className="emp-detail-item">
                <span className="emp-detail-label">Monthly Sales Target</span>
                <strong className="emp-detail-value tabular-nums">{formatInr(targetMonthlySales)}</strong>
              </div>

              <div className="emp-detail-item">
                <span className="emp-detail-label">Assigned Staff</span>
                <strong className="emp-detail-value">
                  {assignedStaffCount} {assignedStaffCount === 1 ? 'employee' : 'employees'}
                </strong>
              </div>

              <div className="emp-detail-item" style={{ gridColumn: 'span 2' }}>
                <span className="emp-detail-label">Badge Accent Color</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: colorHex,
                      border: '2px solid #fff',
                      boxShadow: '0 0 0 1px #cbd5e1',
                    }}
                  />
                  <code style={{ fontSize: 12.5, color: 'var(--text)' }}>{colorHex}</code>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="button" className="btn btn-sm" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* ---------------- EDITABLE FORM VIEW ---------------- */}
        {viewMode === 'edit' && (
          <form className="modal-body" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-grid">
              <div className="field">
                <label className="field-label">Department Code *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. BRIDAL_SILK"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="field">
                <label className="field-label">Monthly Sales Target (₹) *</label>
                <input
                  type="number"
                  className="input"
                  min={0}
                  step="1000"
                  value={targetMonthlySales}
                  onChange={(e) => setTargetMonthlySales(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label">Department Name *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Bridal & Kanjivaram Silks"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="field-label">Badge Accent Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <input
                  type="color"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  style={{ width: 40, height: 34, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                />
                {COLOR_PRESETS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setColorHex(hex)}
                    aria-label={`Select color ${hex}`}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: hex,
                      border: colorHex.toUpperCase() === hex ? '2px solid #0f172a' : '2px solid #fff',
                      boxShadow: '0 0 0 1px #cbd5e1',
                      cursor: 'pointer',
                    }}
                  />
                ))}
                <code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{colorHex}</code>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (isExisting) {
                    setViewMode('details');
                  } else {
                    onClose();
                  }
                }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : isExisting ? 'Save Department' : 'Add Department'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
