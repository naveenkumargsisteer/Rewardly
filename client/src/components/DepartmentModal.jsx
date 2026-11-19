import React, { useEffect, useState } from 'react';
import {
  Building2,
  Pencil,
  Trash2,
  X,
  Users,
  CheckCircle2,
  AlertTriangle,
  Shuffle,
  UserPlus,
  UserMinus,
  Sparkles,
} from 'lucide-react';
import { api, formatInr } from '../api/client';
import EmployeeAvatar from './EmployeeAvatar';

const COLOR_PRESETS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DB2777', '#0891B2'];

export default function DepartmentModal({
  isOpen,
  initialDepartment,
  assignedStaffCount = 0,
  mode = 'details', // 'details' | 'edit'
  allEmployees = [],
  departments = [],
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

  // Staff management state
  const [staffList, setStaffList] = useState([]);
  const [staffTargets, setStaffTargets] = useState({});
  const [reassignments, setReassignments] = useState([]); // [{ id, department_id }]

  // Add staff form state
  const [addEmpId, setAddEmpId] = useState('');
  const [addEmpTarget, setAddEmpTarget] = useState('');

  // Reassign / remove inline state
  const [reassigningEmpId, setReassigningEmpId] = useState(null);
  const [reassignTargetDeptId, setReassignTargetDeptId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setReassigningEmpId(null);
    setAddEmpId('');
    setAddEmpTarget('');
    setReassignments([]);

    if (initialDepartment) {
      setViewMode(mode || 'details');
      setCode(initialDepartment.code || '');
      setName(initialDepartment.name || '');
      const deptTarget = Number(initialDepartment.target_monthly_sales ?? 1000000);
      setTargetMonthlySales(String(deptTarget));
      setColorHex(initialDepartment.color_hex || '#7C3AED');

      // Filter assigned staff
      const assigned = (allEmployees || []).filter(
        (e) => e.department_id === initialDepartment.id
      );
      setStaffList(assigned);

      // Populate staff targets from employee object or default distribution
      const initialTargets = {};
      const defaultPerStaff = assigned.length > 0 ? Math.round(deptTarget / assigned.length) : 0;
      assigned.forEach((emp) => {
        initialTargets[emp.id] =
          emp.target_monthly_sales != null && emp.target_monthly_sales > 0
            ? emp.target_monthly_sales
            : defaultPerStaff;
      });
      setStaffTargets(initialTargets);
    } else {
      setViewMode('edit');
      setCode('');
      setName('');
      setTargetMonthlySales('1000000');
      setColorHex('#7C3AED');
      setStaffList([]);
      setStaffTargets({});
    }
  }, [isOpen, initialDepartment, mode, allEmployees]);

  if (!isOpen) return null;

  // Available employees to add (those not currently in this department)
  const availableEmployees = (allEmployees || []).filter(
    (e) => !staffList.some((s) => s.id === e.id)
  );

  // Other departments for reassigning when removing a staff member
  const otherDepartments = (departments || []).filter(
    (d) => d.id !== initialDepartment?.id
  );

  // Target matching math
  const deptTargetNum = Math.max(0, Number(targetMonthlySales) || 0);
  const sumStaffTargets = staffList.reduce(
    (sum, emp) => sum + (Number(staffTargets[emp.id]) || 0),
    0
  );
  const targetDiff = deptTargetNum - sumStaffTargets;
  const isMatched = Math.abs(targetDiff) < 1;
  const isUnder = targetDiff > 0;
  const isOver = targetDiff < 0;
  const matchPct = deptTargetNum > 0 ? Math.round((sumStaffTargets / deptTargetNum) * 100) : 100;

  // Distribute department target evenly among all assigned staff
  function handleDistributeEvenly() {
    if (staffList.length === 0) return;
    const total = deptTargetNum;
    const count = staffList.length;
    const baseShare = Math.floor(total / count);
    const remainder = total - baseShare * count;

    const nextTargets = { ...staffTargets };
    staffList.forEach((emp, index) => {
      // Allocate the remainder to the first employee so the exact sum matches
      const share = index === 0 ? baseShare + remainder : baseShare;
      nextTargets[emp.id] = share;
    });
    setStaffTargets(nextTargets);
  }

  function handleStaffTargetChange(empId, rawVal) {
    const val = rawVal === '' ? '' : Math.max(0, Number(rawVal));
    setStaffTargets((prev) => ({
      ...prev,
      [empId]: val,
    }));
  }

  // Add staff member to this department
  function handleAddStaff() {
    if (!addEmpId) return;
    const empToAdd = availableEmployees.find((e) => e.id === addEmpId);
    if (!empToAdd) return;

    const assignedTarget =
      addEmpTarget !== ''
        ? Math.max(0, Number(addEmpTarget))
        : isUnder && targetDiff > 0
          ? targetDiff
          : staffList.length > 0
            ? Math.round(deptTargetNum / (staffList.length + 1))
            : deptTargetNum;

    setStaffList((prev) => [...prev, empToAdd]);
    setStaffTargets((prev) => ({
      ...prev,
      [empToAdd.id]: assignedTarget,
    }));

    // Record reassign into this department
    if (initialDepartment?.id) {
      setReassignments((prev) => [
        ...prev.filter((r) => r.id !== empToAdd.id),
        { id: empToAdd.id, department_id: initialDepartment.id },
      ]);
    }

    setAddEmpId('');
    setAddEmpTarget('');
  }

  // Remove staff member from this department (reassign to another department)
  function handleConfirmRemove(empId, destDeptId) {
    if (!destDeptId) return;
    const empToRemove = staffList.find((e) => e.id === empId);
    if (!empToRemove) return;

    setStaffList((prev) => prev.filter((e) => e.id !== empId));
    setStaffTargets((prev) => {
      const next = { ...prev };
      delete next[empId];
      return next;
    });

    setReassignments((prev) => [
      ...prev.filter((r) => r.id !== empId),
      { id: empId, department_id: destDeptId },
    ]);

    setReassigningEmpId(null);
    setReassignTargetDeptId('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        target_monthly_sales: deptTargetNum,
        color_hex: colorHex,
        staff_targets: staffTargets,
        reassigned_employees: reassignments,
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
      <div
        className="modal-card"
        style={{
          maxWidth: 720,
          width: '95%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 20,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.22)',
          padding: 0,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `${colorHex}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Building2 size={20} color={colorHex || '#6d28d9'} />
            </div>
            <div>
              <strong style={{ fontSize: 16.5, display: 'block', color: 'var(--text)' }}>
                {viewMode === 'details'
                  ? `Department: ${name || code}`
                  : isExisting
                    ? `Edit Department: ${name || code}`
                    : 'Add New Department'}
              </strong>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {code ? `Code: ${code} • ` : ''}Manage sales targets and assigned showroom staff
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {viewMode === 'details' && isExisting && (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setViewMode('edit')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Pencil size={13} /> Edit Department &amp; Staff
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => onDelete?.(initialDepartment)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </>
            )}
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Close modal"
              style={{ padding: 6 }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            style={{
              margin: '12px 24px 0',
              padding: '10px 14px',
              borderRadius: 10,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div
          className="modal-body"
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {/* 1. Target Allocation & Match Summary Card (Always Visible) */}
          <div
            style={{
              background: 'linear-gradient(135deg, #faf5ff 0%, #f5f3ff 50%, #eff6ff 100%)',
              border: '1.5px solid #ddd6fe',
              borderRadius: 14,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color="#7c3aed" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#4c1d95' }}>
                  Target Allocation &amp; Matching
                </span>
              </div>

              {viewMode === 'edit' && staffList.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={handleDistributeEvenly}
                  title="Automatically distribute department target equally among assigned staff"
                  style={{
                    fontSize: 11.5,
                    padding: '4px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#ffffff',
                    border: '1px solid #c4b5fd',
                    color: '#6d28d9',
                    fontWeight: 700,
                  }}
                >
                  <Shuffle size={13} /> Distribute Target Evenly
                </button>
              )}
            </div>

            {/* Target Comparison Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 12,
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #e9d5ff',
                }}
              >
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
                  Department Target
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#5b21b6', marginTop: 2 }}>
                  {formatInr(deptTargetNum)}
                </div>
              </div>

              <div
                style={{
                  background: '#ffffff',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #e9d5ff',
                }}
              >
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
                  Allocated to Staff ({staffList.length})
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1e1b4b', marginTop: 2 }}>
                  {formatInr(sumStaffTargets)}
                </div>
              </div>

              <div
                style={{
                  background: '#ffffff',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: isMatched
                    ? '1.5px solid #10b981'
                    : isUnder
                      ? '1.5px solid #f59e0b'
                      : '1.5px solid #ef4444',
                }}
              >
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
                  Allocation Status
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    color: isMatched ? '#059669' : isUnder ? '#d97706' : '#dc2626',
                  }}
                >
                  {isMatched ? (
                    <>
                      <CheckCircle2 size={16} /> Matched 100%
                    </>
                  ) : isUnder ? (
                    <>
                      <AlertTriangle size={15} /> Remaining: {formatInr(targetDiff)}
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={15} /> Exceeds by: {formatInr(Math.abs(targetDiff))}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Target Progress Bar */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: '#6b7280',
                  marginBottom: 4,
                }}
              >
                <span>Department Target Coverage</span>
                <strong
                  style={{
                    color: isMatched ? '#059669' : isUnder ? '#d97706' : '#dc2626',
                  }}
                >
                  {matchPct}%
                </strong>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: '#e2e8f0',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, matchPct)}%`,
                    background: isMatched
                      ? '#10b981'
                      : isUnder
                        ? '#7c3aed'
                        : '#ef4444',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          </div>

          {/* ---------------- READ-ONLY VIEW ---------------- */}
          {viewMode === 'details' && (
            <>
              {/* Department Key Info */}
              <div className="emp-profile-banner" style={{ margin: 0 }}>
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
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Showroom Textile Department • {staffList.length}{' '}
                      {staffList.length === 1 ? 'staff member' : 'staff members'}
                    </div>
                  </div>
                </div>
                <span className="brand-badge" style={{ fontSize: 12 }}>
                  {code}
                </span>
              </div>

              {/* Assigned Staff Table in Details Mode */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <strong style={{ fontSize: 13.5, color: 'var(--text)' }}>
                    Assigned Staff &amp; Individual Targets ({staffList.length})
                  </strong>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setViewMode('edit')}
                    style={{ fontSize: 12 }}
                  >
                    Edit Targets / Staff
                  </button>
                </div>

                {staffList.length === 0 ? (
                  <div
                    style={{
                      padding: 24,
                      textAlign: 'center',
                      background: '#f8fafc',
                      borderRadius: 12,
                      color: 'var(--text-muted)',
                      fontSize: 13,
                    }}
                  >
                    No staff currently assigned to this department. Click &ldquo;Edit Department &amp; Staff&rdquo; to add staff.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Staff Member</th>
                          <th>Code</th>
                          <th>Role</th>
                          <th style={{ textAlign: 'right' }}>Monthly Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffList.map((emp) => (
                          <tr key={emp.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <EmployeeAvatar employee={emp} size={30} />
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 13 }}>{emp.full_name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.email}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="brand-badge">{emp.emp_code}</span>
                            </td>
                            <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{emp.role}</td>
                            <td style={{ textAlign: 'right' }}>
                              <strong className="tabular-nums" style={{ color: 'var(--primary)' }}>
                                {formatInr(staffTargets[emp.id] || 0)}
                              </strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-sm" onClick={onClose}>
                  Close
                </button>
              </div>
            </>
          )}

          {/* ---------------- EDITABLE FORM VIEW ---------------- */}
          {viewMode === 'edit' && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Department Fields */}
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
                  <label className="field-label">Department Monthly Target (₹) *</label>
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
                    style={{
                      width: 36,
                      height: 32,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                  {COLOR_PRESETS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setColorHex(hex)}
                      aria-label={`Select color ${hex}`}
                      style={{
                        width: 22,
                        height: 22,
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

              {/* Assigned Staff & Individual Targets Section */}
              <div style={{ marginTop: 4 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={16} color="#6d28d9" />
                    <strong style={{ fontSize: 14, color: 'var(--text)' }}>
                      Assigned Staff &amp; Target Distribution ({staffList.length})
                    </strong>
                  </div>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Set individual monthly sales targets
                  </span>
                </div>

                {staffList.length === 0 ? (
                  <div
                    style={{
                      padding: 20,
                      textAlign: 'center',
                      background: '#f8fafc',
                      borderRadius: 12,
                      border: '1px dashed #cbd5e1',
                      color: 'var(--text-muted)',
                      fontSize: 13,
                    }}
                  >
                    No staff currently assigned. Use &ldquo;Add Staff from Other Departments&rdquo; below to assign staff members.
                  </div>
                ) : (
                  <div
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: '#ffffff',
                    }}
                  >
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Staff Member</th>
                          <th>Role</th>
                          <th style={{ width: 170 }}>Monthly Target (₹)</th>
                          <th style={{ width: 80, textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffList.map((emp) => (
                          <React.Fragment key={emp.id}>
                            <tr>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <EmployeeAvatar employee={emp} size={30} />
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{emp.full_name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                      <span className="brand-badge" style={{ fontSize: 10, padding: '1px 6px' }}>
                                        {emp.emp_code}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.role}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: '#6d28d9' }}>₹</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1000"
                                    className="input"
                                    style={{
                                      padding: '5px 8px',
                                      fontSize: 13,
                                      fontWeight: 700,
                                      width: 130,
                                    }}
                                    value={staffTargets[emp.id] ?? ''}
                                    onChange={(e) => handleStaffTargetChange(emp.id, e.target.value)}
                                    placeholder="20000"
                                    required
                                  />
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => {
                                    setReassigningEmpId(reassigningEmpId === emp.id ? null : emp.id);
                                    setReassignTargetDeptId(otherDepartments[0]?.id || '');
                                  }}
                                  title="Remove from this department and reassign"
                                  style={{
                                    fontSize: 11,
                                    padding: '3px 8px',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca',
                                    background: '#fef2f2',
                                  }}
                                >
                                  <UserMinus size={13} /> Remove
                                </button>
                              </td>
                            </tr>

                            {/* Inline Reassign Drawer when Remove is clicked */}
                            {reassigningEmpId === emp.id && (
                              <tr style={{ background: '#fffbeb' }}>
                                <td colSpan={4} style={{ padding: '10px 14px' }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      flexWrap: 'wrap',
                                      gap: 8,
                                    }}
                                  >
                                    <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                                      Reassign <strong>{emp.full_name}</strong> to department:
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <select
                                        className="select"
                                        style={{ fontSize: 12, padding: '4px 8px' }}
                                        value={reassignTargetDeptId}
                                        onChange={(e) => setReassignTargetDeptId(e.target.value)}
                                      >
                                        {otherDepartments.map((dept) => (
                                          <option key={dept.id} value={dept.id}>
                                            {dept.name} ({dept.code})
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-danger"
                                        style={{ fontSize: 11, padding: '4px 10px' }}
                                        onClick={() => handleConfirmRemove(emp.id, reassignTargetDeptId)}
                                      >
                                        Confirm Move
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-sm"
                                        style={{ fontSize: 11, padding: '4px 8px' }}
                                        onClick={() => setReassigningEmpId(null)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Add Staff Section */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UserPlus size={15} color="#059669" />
                  <strong style={{ fontSize: 13, color: '#0f172a' }}>
                    Add Staff to this Department
                  </strong>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <select
                    className="select"
                    style={{ flex: 1, minWidth: 200, fontSize: 12.5 }}
                    value={addEmpId}
                    onChange={(e) => {
                      setAddEmpId(e.target.value);
                      if (!addEmpTarget) {
                        setAddEmpTarget(
                          String(
                            isUnder && targetDiff > 0
                              ? targetDiff
                              : Math.round(deptTargetNum / (staffList.length + 1))
                          )
                        );
                      }
                    }}
                  >
                    <option value="">Select staff member to transfer...</option>
                    {availableEmployees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name} ({e.emp_code}) — Currently in {e.department_name}
                      </option>
                    ))}
                  </select>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9' }}>₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="Target (₹)"
                      className="input"
                      style={{ width: 120, fontSize: 12.5, padding: '6px 8px' }}
                      value={addEmpTarget}
                      onChange={(e) => setAddEmpTarget(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{
                      fontSize: 12,
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                    }}
                    onClick={handleAddStaff}
                    disabled={!addEmpId}
                  >
                    <UserPlus size={13} /> Add Staff
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 6,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border)',
                }}
              >
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
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {submitting
                    ? 'Saving...'
                    : isExisting
                      ? 'Save Department & Staff Targets'
                      : 'Add Department'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
