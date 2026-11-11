import React, { useEffect, useState } from 'react';
import { X, Award } from 'lucide-react';
import { api } from '../api/client';

export default function GiveRecognitionModal({
  isOpen,
  employees,
  preselectedEmployeeId,
  defaultDate,
  onClose,
  onSuccess,
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [recognitionType, setRecognitionType] = useState('Manager');
  const [badgeTitle, setBadgeTitle] = useState('Festive Sales Star');
  const [points, setPoints] = useState(35);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmployeeId(preselectedEmployeeId || employees?.[0]?.id || '');
      setMessage('');
    }
  }, [isOpen, preselectedEmployeeId, employees]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!employeeId || !message.trim()) return;
    setSubmitting(true);
    try {
      await api.createRecognition({
        employee_id: employeeId,
        given_by_name: 'Rajeshwari Deshpande',
        recognition_type: recognitionType,
        badge_title: badgeTitle,
        points: Number(points),
        message: message.trim(),
        recognition_date: defaultDate || '2026-11-11',
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={18} color="#6d28d9" />
            <strong style={{ fontSize: 16 }}>Give Employee Recognition</strong>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field-label">Select Employee</label>
            <select className="select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {(employees || []).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.emp_code}) — {emp.department_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-grid">
            <div className="field">
              <label className="field-label">Recognition Type</label>
              <select className="select" value={recognitionType} onChange={(e) => setRecognitionType(e.target.value)}>
                <option value="Manager">Manager</option>
                <option value="Peer-to-Peer">Peer-to-Peer</option>
                <option value="Customer Praise">Customer Praise</option>
                <option value="Milestone">Milestone</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label">Loyalty Points</label>
              <input
                type="number"
                className="input"
                min={5}
                max={200}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Badge Title</label>
            <input
              type="text"
              className="input"
              value={badgeTitle}
              onChange={(e) => setBadgeTitle(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="field-label">Recognition Message</label>
            <textarea
              className="textarea"
              rows={3}
              placeholder="e.g. Handled 4 bridal family saree consultations seamlessly during weekend rush!"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Award Recognition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

