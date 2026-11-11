import React, { useEffect, useState } from 'react';
import { X, Building2 } from 'lucide-react';
import { api } from '../api/client';

const COLOR_PRESETS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DB2777', '#0891B2'];

export default function DepartmentModal({ isOpen, initialDepartment, onClose, onSaved }) {
  const isEdit = Boolean(initialDepartment);
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
      setCode(initialDepartment.code || '');
      setName(initialDepartment.name || '');
      setTargetMonthlySales(String(initialDepartment.target_monthly_sales ?? 1000000));
      setColorHex(initialDepartment.color_hex || '#7C3AED');
    } else {
      setCode('');
      setName('');
      setTargetMonthlySales('1000000');
      setColorHex('#7C3AED');
    }
  }, [isOpen, initialDepartment]);

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
      const saved = isEdit
        ? await api.updateDepartment(initialDepartment.id, payload)
        : await api.createDepartment(payload);
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
      <div className="modal-card narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={18} color="#6d28d9" />
            <strong style={{ fontSize: 16 }}>
              {isEdit ? 'Edit Department' : 'Add New Department'}
            </strong>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : isEdit ? 'Save Department' : 'Add Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

