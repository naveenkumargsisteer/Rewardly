import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  QrCode,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
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
  const [copiedQrLink, setCopiedQrLink] = useState(false);
  const qrCanvasRef = useRef(null);

  const activeQrCode = (form.emp_code || initialEmployee?.emp_code || '').trim().toUpperCase();
  const feedbackUrl =
    isEdit && activeQrCode && typeof window !== 'undefined'
      ? `${window.location.origin}/feedback/${encodeURIComponent(activeQrCode)}`
      : '';
  const codeModified =
    isEdit &&
    Boolean(initialEmployee?.emp_code) &&
    activeQrCode !== String(initialEmployee.emp_code).toUpperCase();

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setCopiedQrLink(false);
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

  useEffect(() => {
    if (!isOpen || !isEdit || !feedbackUrl || !qrCanvasRef.current) return;
    QRCode.toCanvas(
      qrCanvasRef.current,
      feedbackUrl,
      {
        width: 136,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#1e1b4b', light: '#ffffff' },
      },
      () => {}
    );
  }, [isOpen, isEdit, feedbackUrl]);

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

  async function handleCopyFeedbackLink() {
    if (!feedbackUrl) return;
    try {
      await navigator.clipboard.writeText(feedbackUrl);
      setCopiedQrLink(true);
      setTimeout(() => setCopiedQrLink(false), 2000);
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  }

  async function handleDownloadQrPng() {
    if (!feedbackUrl) return;
    const width = 600;
    const height = 760;
    const cardCanvas = document.createElement('canvas');
    cardCanvas.width = width;
    cardCanvas.height = height;
    const ctx = cardCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#f8f7fc';
    ctx.fillRect(0, 0, width, height);

    const grad = ctx.createLinearGradient(0, 0, width, 150);
    grad.addColorStop(0, '#6d28d9');
    grad.addColorStop(1, '#4f46e5');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, 150);

    try {
      const logoImg = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = '/rewardly-logo.png';
      });
      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.beginPath();
      ctx.arc(68, 74, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(logoImg, 46, 52, 44, 44);
    } catch {
      // Proceed even if logo fails to decode
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Inter, system-ui, sans-serif';
    ctx.fillText('Rewardly Customer Feedback', 114, 72);
    ctx.font = '16px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fillText('Scan QR to rate your shopping experience', 114, 102);

    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, feedbackUrl, {
      width: 380,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#1e1b4b', light: '#ffffff' },
    });

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ddd6fe';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(90, 185, 420, 420, 24);
    ctx.fill();
    ctx.stroke();
    ctx.drawImage(qrCanvas, 110, 205, 380, 380);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 26px Inter, system-ui, sans-serif';
    ctx.fillText(form.full_name || initialEmployee?.full_name || 'Associate', width / 2, 650);

    ctx.fillStyle = '#6d28d9';
    ctx.font = 'bold 18px Inter, system-ui, sans-serif';
    const roleLabel = form.role || initialEmployee?.role || 'Sales Associate';
    ctx.fillText(`${activeQrCode} • ${roleLabel}`, width / 2, 684);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.fillText('Anonymous QR review • No app or sign-in required', width / 2, 718);

    const link = document.createElement('a');
    link.href = cardCanvas.toDataURL('image/png');
    link.download = `rewardly-qr-${activeQrCode.toLowerCase()}.png`;
    link.click();
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

          {isEdit && activeQrCode && (
            <div className="qr-card-box">
              <div className="qr-canvas-wrap">
                <canvas ref={qrCanvasRef} aria-label={`QR code for ${activeQrCode}`} />
              </div>
              <div className="qr-meta-col">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13.5, color: '#1e1b4b' }}>
                  <QrCode size={15} color="#6d28d9" />
                  Customer Feedback QR Code ({activeQrCode})
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  Customers can scan this QR from any mobile device to leave an anonymous rating & optional note.
                </div>
                {codeModified && (
                  <div style={{ fontSize: 11.5, color: '#b45309', fontWeight: 600, marginTop: 4 }}>
                    Save changes to activate updated employee code in QR link.
                  </div>
                )}
                <div className="qr-url-box">{feedbackUrl}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadQrPng}>
                    <Download size={13} />
                    Download QR PNG
                  </button>
                  <button type="button" className="btn btn-sm" onClick={handleCopyFeedbackLink}>
                    {copiedQrLink ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                    {copiedQrLink ? 'Copied!' : 'Copy Link'}
                  </button>
                  <a
                    href={feedbackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm"
                    style={{ textDecoration: 'none' }}
                  >
                    <ExternalLink size={13} />
                    Preview Mobile Page
                  </a>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
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

