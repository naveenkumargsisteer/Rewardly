import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Sliders, Store, Building2, Users, Plus, UserPlus, Pencil, Trash2, Search, X, AlertTriangle, UploadCloud,
} from 'lucide-react';
import { api, formatInr, formatDate } from '../api/client';
import DepartmentModal from '../components/DepartmentModal';
import EmployeeFormModal from '../components/EmployeeFormModal';
import EmployeeAvatar from '../components/EmployeeAvatar';
import RewardlyLoader from '../components/RewardlyLoader';
import CsvImportModal from '../components/CsvImportModal';

function getNextEmpCode(employees) {
  let maxNum = 0;
  for (const emp of employees || []) {
    const match = String(emp.emp_code || '').match(/(\d+)$/);
    if (match) {
      maxNum = Math.max(maxNum, Number(match[1]));
    }
  }
  return `KVR-${String(maxNum + 1).padStart(3, '0')}`;
}

export default function SettingsPage({ onBack, onSettingsSaved, showToast }) {
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState(null);
  const [settings, setSettings] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [savingWeights, setSavingWeights] = useState(false);
  const [savingShop, setSavingShop] = useState(false);

  // Employee filters
  const [empSearch, setEmpSearch] = useState('');
  const [empDeptFilter, setEmpDeptFilter] = useState('all');
  const [empStatusFilter, setEmpStatusFilter] = useState('all');

  // Modals state
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [deptModalMode, setDeptModalMode] = useState('details'); // 'details' | 'edit'
  const [editingDept, setEditingDept] = useState(null);
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [empModalMode, setEmpModalMode] = useState('details'); // 'details' | 'edit'
  const [editingEmp, setEditingEmp] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  async function loadSettings({ silent = false } = {}) {
    if (!silent) setLoading(true);
    try {
      const data = await api.getSettings();
      setShop(data.shop);
      setSettings(data.settings);
      setDepartments(data.departments || []);
      setEmployees(data.employees || []);
    } catch (err) {
      showToast(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const deptEmployeeCounts = useMemo(() => {
    const counts = {};
    for (const emp of employees) {
      counts[emp.department_id] = (counts[emp.department_id] || 0) + 1;
    }
    return counts;
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    return employees.filter((emp) => {
      if (empDeptFilter !== 'all' && emp.department_id !== empDeptFilter) return false;
      if (empStatusFilter !== 'all' && emp.status !== empStatusFilter) return false;
      if (!q) return true;
      return (
        String(emp.full_name || '').toLowerCase().includes(q) ||
        String(emp.emp_code || '').toLowerCase().includes(q) ||
        String(emp.email || '').toLowerCase().includes(q) ||
        String(emp.role || '').toLowerCase().includes(q) ||
        String(emp.department_name || '').toLowerCase().includes(q)
      );
    });
  }, [employees, empSearch, empDeptFilter, empStatusFilter]);

  if (loading || !settings || !shop) {
    return (
      <div>
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center' }}>
          <button type="button" className="btn btn-soft btn-sm" onClick={onBack}>
            <ArrowLeft size={15} /> Back to Dashboard
          </button>
        </div>
        <RewardlyLoader message="Loading Rewardly settings..." />
      </div>
    );
  }

  const totalWeight =
    Number(settings.attendance_weight || 0) +
    Number(settings.feedback_weight || 0) +
    Number(settings.sales_weight || 0);

  // Auto-balance weights so total NEVER crosses 100% and always remains 100%
  function handleWeightChange(changedKey, rawValue) {
    const newVal = Math.min(100, Math.max(0, Math.round(Number(rawValue) || 0)));
    const keys = ['attendance_weight', 'feedback_weight', 'sales_weight'];
    const otherKeys = keys.filter((k) => k !== changedKey);
    const rem = 100 - newVal;

    const currentW1 = Number(settings[otherKeys[0]] ?? 0);
    const currentW2 = Number(settings[otherKeys[1]] ?? 0);
    const sumOther = currentW1 + currentW2;

    let nextW1 = 0;
    let nextW2 = 0;

    if (rem === 0) {
      nextW1 = 0;
      nextW2 = 0;
    } else if (sumOther > 0) {
      nextW1 = Math.round(rem * (currentW1 / sumOther));
      nextW2 = rem - nextW1;
    } else {
      nextW1 = Math.floor(rem / 2);
      nextW2 = rem - nextW1;
    }

    setSettings((prev) => ({
      ...prev,
      [changedKey]: newVal,
      [otherKeys[0]]: nextW1,
      [otherKeys[1]]: nextW2,
    }));
  }

  async function handleSaveSettings(e) {
    e?.preventDefault();
    if (totalWeight !== 100) {
      if (
        !window.confirm(
          `Total weights currently sum to ${totalWeight}%. The recommended total is 100% (e.g. 70% Attendance, 10% Feedback, 20% Sales). Do you want to save anyway?`
        )
      ) {
        return;
      }
    }
    setSavingWeights(true);
    try {
      const payload = {
        ...settings,
        recognition_weight: 0,
      };
      const updated = await api.updateSettings({ settings: payload });
      setSettings(updated.settings);
      onSettingsSaved();
      showToast('Performance score weights saved successfully!');
    } catch (err) {
      showToast(err.message);
    } finally {
      setSavingWeights(false);
    }
  }

  async function handleSaveShop(e) {
    e.preventDefault();
    setSavingShop(true);
    try {
      const updated = await api.updateSettings({ shop });
      setShop(updated.shop);
      onSettingsSaved();
      showToast('Showroom profile updated!');
    } catch (err) {
      showToast(err.message);
    } finally {
      setSavingShop(false);
    }
  }

  async function handleDepartmentSaved(saved, isEdit) {
    await loadSettings({ silent: true });
    onSettingsSaved();
    showToast(isEdit ? `Department "${saved.name}" updated!` : `Department "${saved.name}" added!`);
  }

  async function handleEmployeeSaved(saved, isEdit) {
    await loadSettings({ silent: true });
    onSettingsSaved();
    showToast(isEdit ? `Employee "${saved.full_name}" updated!` : `Employee "${saved.full_name}" added!`);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      if (deleteTarget.type === 'department') {
        await api.deleteDepartment(deleteTarget.item.id);
        showToast(`Department "${deleteTarget.item.name}" deleted.`);
      } else {
        await api.deleteEmployee(deleteTarget.item.id);
        showToast(`Employee "${deleteTarget.item.full_name}" deleted.`);
      }
      setDeleteTarget(null);
      await loadSettings({ silent: true });
      onSettingsSaved();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="settings-grid">
      <div className="col-12" style={{ display: 'flex', alignItems: 'center' }}>
        <button type="button" className="btn btn-soft btn-sm" onClick={onBack}>
          <ArrowLeft size={15} /> Back to Dashboard
        </button>
      </div>

      {/* 1. CONFIGURABLE PERFORMANCE SCORE WEIGHTS */}
      <form className="card col-6" onSubmit={handleSaveSettings}>
        <div className="card-header">
          <div className="card-title-row">
            <Sliders size={18} color="#6d28d9" />
            <span>Configurable Performance Score Weights</span>
          </div>
          <span
            className={`status-badge ${totalWeight === 100 ? 'status-Approved' : 'status-Pending'}`}
            style={{
              fontWeight: 700,
              fontSize: 12,
              background: totalWeight === 100 ? '#ecfdf5' : '#fef2f2',
              color: totalWeight === 100 ? '#059669' : '#dc2626',
              border: `1px solid ${totalWeight === 100 ? '#a7f3d0' : '#fecaca'}`,
            }}
          >
            {totalWeight === 100 ? '✓ Total: 100% (Balanced)' : `Total: ${totalWeight}%`}
          </span>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 0 }}>
          Adjust how Rewardly computes each employee&apos;s composite score across Attendance, Customer Feedback, and Sales Target. Sliders automatically auto-balance so the total is always locked at 100%.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { key: 'attendance_weight', label: 'Attendance & Punctuality Weight (%)' },
            { key: 'feedback_weight', label: 'Customer Feedback Rating Weight (%)' },
            { key: 'sales_weight', label: 'Showroom Net Sales Target Weight (%)' },
          ].map((item) => (
            <div className="field" key={item.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{item.label}</span>
                <strong className="tabular-nums" style={{ color: 'var(--primary)', fontWeight: 800 }}>
                  {settings[item.key] ?? 0}%
                </strong>
              </div>
              <div className="slider-row">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings[item.key] ?? 0}
                  onChange={(e) => handleWeightChange(item.key, e.target.value)}
                />
              </div>
            </div>
          ))}

          {/* Quick 100% Presets Bar */}
          <div
            style={{
              padding: '10px 12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
              Quick 100% Presets:
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '4px 8px' }}
                onClick={() =>
                  setSettings({
                    ...settings,
                    attendance_weight: 70,
                    feedback_weight: 10,
                    sales_weight: 20,
                  })
                }
              >
                70% Att / 10% FB / 20% Sales
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '4px 8px' }}
                onClick={() =>
                  setSettings({
                    ...settings,
                    attendance_weight: 80,
                    feedback_weight: 10,
                    sales_weight: 10,
                  })
                }
              >
                80% Att / 10% FB / 10% Sales
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '4px 8px' }}
                onClick={() =>
                  setSettings({
                    ...settings,
                    attendance_weight: 60,
                    feedback_weight: 20,
                    sales_weight: 20,
                  })
                }
              >
                60% Att / 20% FB / 20% Sales
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '4px 8px' }}
                onClick={() =>
                  setSettings({
                    ...settings,
                    attendance_weight: 50,
                    feedback_weight: 25,
                    sales_weight: 25,
                  })
                }
              >
                50% Att / 25% FB / 25% Sales
              </button>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label className="field-label">Gold Reward Tier Threshold (%)</label>
              <input
                type="number"
                className="input"
                min={50}
                max={99}
                value={settings.gold_threshold}
                onChange={(e) => setSettings({ ...settings, gold_threshold: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label className="field-label">Silver Tier Threshold (%)</label>
              <input
                type="number"
                className="input"
                min={40}
                max={95}
                value={settings.silver_threshold}
                onChange={(e) => setSettings({ ...settings, silver_threshold: Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={savingWeights || totalWeight <= 0}>
              {savingWeights ? 'Saving...' : 'Save & Recalculate Scores'}
            </button>
          </div>
        </div>
      </form>

      {/* 3. SHOWROOM PROFILE */}
      <form className="card col-6" onSubmit={handleSaveShop}>
        <div className="card-header">
          <div className="card-title-row">
            <Store size={18} color="#3b82f6" />
            <span>Textile Showroom Profile</span>
          </div>
          <span className="brand-badge">{shop.currency || 'INR'} ₹</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field-label">Showroom Name</label>
            <input
              type="text"
              className="input"
              value={shop.name}
              onChange={(e) => setShop({ ...shop, name: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="field-label">Tagline</label>
            <input
              type="text"
              className="input"
              value={shop.tagline || ''}
              onChange={(e) => setShop({ ...shop, tagline: e.target.value })}
            />
          </div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label">Branch / Location</label>
              <input
                type="text"
                className="input"
                value={shop.location || ''}
                onChange={(e) => setShop({ ...shop, location: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-label">City</label>
              <input
                type="text"
                className="input"
                value={shop.city || ''}
                onChange={(e) => setShop({ ...shop, city: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Owner / Admin Name</label>
            <input
              type="text"
              className="input"
              value={shop.owner_name || ''}
              onChange={(e) => setShop({ ...shop, owner_name: e.target.value })}
            />
          </div>

          {/* Using Internal billing System Toggle */}
          <div className="field" style={{ marginTop: 4 }}>
            <label className="field-label" style={{ fontWeight: 600, color: 'var(--text-main, #1e293b)' }}>
              Using Internal billing System
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 4 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="radio"
                  name="use_internal_billing"
                  value="yes"
                  checked={shop?.use_internal_billing !== false}
                  onChange={() => setShop({ ...shop, use_internal_billing: true })}
                />
                <span>Yes (Built-in POS)</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="radio"
                  name="use_internal_billing"
                  value="no"
                  checked={shop?.use_internal_billing === false}
                  onChange={() => setShop({ ...shop, use_internal_billing: false })}
                />
                <span>No (External Billing / ERP)</span>
              </label>
            </div>

            {shop?.use_internal_billing === false && (
              <div
                style={{
                  marginTop: 10,
                  padding: '12px 14px',
                  background: 'linear-gradient(135deg, rgba(238, 242, 255, 0.9) 0%, rgba(245, 243, 255, 0.9) 100%)',
                  borderRadius: 12,
                  border: '1.5px dashed #a5b4fc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#3730a3' }}>
                    External Billing Active
                  </div>
                  <div style={{ fontSize: 11.5, color: '#4b5563', marginTop: 2 }}>
                    Offline or third-party POS. Import external sales / billing records.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setCsvModalOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    fontWeight: 700,
                    fontSize: 12,
                    boxShadow: '0 2px 8px rgba(109, 40, 217, 0.25)',
                  }}
                >
                  <UploadCloud size={14} />
                  <span>Import data from other source</span>
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="submit" className="btn btn-primary" disabled={savingShop}>
              {savingShop ? 'Saving...' : 'Save Showroom Profile'}
            </button>
          </div>
        </div>
      </form>

      {/* 3. MANAGE DEPARTMENTS */}
      <div className="card col-12">
        <div className="card-header">
          <div className="section-title-wrap">
            <div className="section-icon">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="section-title">Manage Departments</h2>
              <p className="section-sub">
                Add new showroom departments, update monthly sales targets, or remove unused departments.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="brand-badge">{departments.length} Departments</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { setEditingDept(null); setDeptModalMode('edit'); setDeptModalOpen(true); }}
            >
              <Plus size={15} /> Add Department
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Department Name</th>
                <th>Monthly Target</th>
                <th>Assigned Staff</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr style={{ cursor: 'default' }}>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    No departments found. Click &ldquo;Add Department&rdquo; to create one.
                  </td>
                </tr>
              ) : departments.map((dept) => {
                const staffCount = deptEmployeeCounts[dept.id] || 0;
                return (
                  <tr
                    key={dept.id}
                    className="clickable-row"
                    onClick={() => { setEditingDept(dept); setDeptModalMode('details'); setDeptModalOpen(true); }}
                    title="Click to view department details"
                  >
                    <td>
                      <span className="brand-badge">{dept.code}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: dept.color_hex || '#7C3AED',
                            flexShrink: 0,
                          }}
                        />
                        <strong>{dept.name}</strong>
                      </div>
                    </td>
                    <td className="tabular-nums">{formatInr(dept.target_monthly_sales)}</td>
                    <td className="tabular-nums">
                      {staffCount} {staffCount === 1 ? 'employee' : 'employees'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. MANAGE EMPLOYEES */}
      <div className="card col-12">
        <div className="card-header">
          <div className="section-title-wrap">
            <div className="section-icon">
              <Users size={18} />
            </div>
            <div>
              <h2 className="section-title">Manage Employees</h2>
              <p className="section-sub">
                Add new staff profiles, edit roles, shifts, salaries, or department assignments, and remove profiles.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="brand-badge">{employees.length} Employees</span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={departments.length === 0}
              onClick={() => { setEditingEmp(null); setEmpModalMode('edit'); setEmpModalOpen(true); }}
            >
              <UserPlus size={15} /> Add Employee
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: 32 }}
              placeholder="Search name, code, email, or role..."
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
            />
          </div>
          <select
            className="select"
            style={{ width: 'auto', minWidth: 190 }}
            value={empDeptFilter}
            onChange={(e) => setEmpDeptFilter(e.target.value)}
          >
            <option value="all">All Departments ({departments.length})</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: 'auto', minWidth: 140 }}
            value={empStatusFilter}
            onChange={(e) => setEmpStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Code</th>
                <th>Department</th>
                <th>Role &amp; Shift</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr style={{ cursor: 'default' }}>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                    No employees match the current filters.
                  </td>
                </tr>
              ) : filteredEmployees.map((emp) => (
                <tr
                  key={emp.id}
                  className="clickable-row"
                  onClick={() => { setEditingEmp(emp); setEmpModalMode('details'); setEmpModalOpen(true); }}
                  title="Click to view employee details"
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <EmployeeAvatar employee={emp} size={34} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{emp.full_name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="brand-badge">{emp.emp_code}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: emp.department_color || '#7C3AED',
                          flexShrink: 0,
                        }}
                      />
                      <span>{emp.department_name}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{emp.role}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{emp.shift}</div>
                  </td>
                  <td>
                    <span className={`status-badge ${emp.status === 'active' ? 'status-Approved' : 'status-Dismissed'}`}>
                      {emp.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DepartmentModal
        isOpen={deptModalOpen}
        initialDepartment={editingDept}
        assignedStaffCount={editingDept ? (deptEmployeeCounts[editingDept.id] || 0) : 0}
        mode={deptModalMode}
        allEmployees={employees}
        departments={departments}
        onClose={() => setDeptModalOpen(false)}
        onSaved={async (saved, isEdit) => {
          await handleDepartmentSaved(saved, isEdit);
          setEditingDept(saved);
        }}
        onDelete={(dept) => {
          setDeptModalOpen(false);
          setDeleteError('');
          setDeleteTarget({ type: 'department', item: dept });
        }}
      />

      <EmployeeFormModal
        isOpen={empModalOpen}
        initialEmployee={editingEmp}
        departments={departments}
        suggestedCode={getNextEmpCode(employees)}
        mode={empModalMode}
        onClose={() => setEmpModalOpen(false)}
        onSaved={(saved, isEdit) => {
          handleEmployeeSaved(saved, isEdit);
          setEditingEmp(saved);
        }}
        onDelete={(emp) => {
          setEmpModalOpen(false);
          setDeleteError('');
          setDeleteTarget({ type: 'employee', item: emp });
        }}
      />

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal-card narrow" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="#dc2626" />
                <strong style={{ fontSize: 16 }}>
                  Delete {deleteTarget.type === 'department' ? 'Department' : 'Employee'}
                </strong>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => !deleting && setDeleteTarget(null)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
                {deleteTarget.type === 'department' ? (
                  <>
                    Are you sure you want to delete department <strong>{deleteTarget.item.name}</strong> ({deleteTarget.item.code})?
                  </>
                ) : (
                  <>
                    Are you sure you want to delete employee <strong>{deleteTarget.item.full_name}</strong> ({deleteTarget.item.emp_code})? This will also remove their sales, attendance, feedback, and recognition history.
                  </>
                )}
              </p>

              {deleteError && (
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
                  {deleteError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* CSV Import Modal for External Billing */}
      <CsvImportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onSuccess={(res) => {
          showToast(`Successfully imported ${res?.inserted ?? 0} sales rows!`);
          loadSettings({ silent: true });
          onSettingsSaved?.();
        }}
      />
    </div>
  );
}

