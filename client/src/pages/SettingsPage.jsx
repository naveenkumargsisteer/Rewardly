import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Sliders, Store, Building2, Users, Plus, UserPlus, Pencil, Trash2, Search, X, AlertTriangle,
} from 'lucide-react';
import { api, formatInr } from '../api/client';
import DepartmentModal from '../components/DepartmentModal';
import EmployeeFormModal from '../components/EmployeeFormModal';
import RewardlyLoader from '../components/RewardlyLoader';

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
  const [editingDept, setEditingDept] = useState(null);
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
    Number(settings.sales_weight) +
    Number(settings.attendance_weight) +
    Number(settings.feedback_weight) +
    Number(settings.recognition_weight);

  async function handleSaveSettings(e) {
    e?.preventDefault();
    setSavingWeights(true);
    try {
      const updated = await api.updateSettings({ settings });
      setSettings(updated.settings);
      onSettingsSaved();
      showToast('Performance score weights saved!');
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
          <span className={`status-badge ${totalWeight === 100 ? 'status-Approved' : 'status-Pending'}`}>
            Total: {totalWeight}%
          </span>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 0 }}>
          Adjust how Rewardly computes each employee&apos;s composite score across Sales, Attendance, Customer Feedback, and Recognition.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { key: 'sales_weight', label: 'Showroom Net Sales Target Weight (%)' },
            { key: 'attendance_weight', label: 'Attendance & Punctuality Weight (%)' },
            { key: 'feedback_weight', label: 'Customer Feedback Rating Weight (%)' },
            { key: 'recognition_weight', label: 'Peer & Manager Recognition Weight (%)' },
          ].map((item) => (
            <div className="field" key={item.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{item.label}</span>
                <strong className="tabular-nums">{settings[item.key]}%</strong>
              </div>
              <div className="slider-row">
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={settings[item.key]}
                  onChange={(e) => setSettings({ ...settings, [item.key]: Number(e.target.value) })}
                />
              </div>
            </div>
          ))}

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
              onClick={() => { setEditingDept(null); setDeptModalOpen(true); }}
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
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr style={{ cursor: 'default' }}>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    No departments found. Click &ldquo;Add Department&rdquo; to create one.
                  </td>
                </tr>
              ) : departments.map((dept) => {
                const staffCount = deptEmployeeCounts[dept.id] || 0;
                return (
                  <tr key={dept.id} style={{ cursor: 'default' }}>
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
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => { setEditingDept(dept); setDeptModalOpen(true); }}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => { setDeleteError(''); setDeleteTarget({ type: 'department', item: dept }); }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
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
              onClick={() => { setEditingEmp(null); setEmpModalOpen(true); }}
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
            <option value="all">All Departments</option>
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
                <th>Salary &amp; Joined</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr style={{ cursor: 'default' }}>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                    No employees match the current filters.
                  </td>
                </tr>
              ) : filteredEmployees.map((emp) => (
                <tr key={emp.id} style={{ cursor: 'default' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        className="avatar"
                        style={{ background: emp.avatar_color || '#7C3AED', width: 34, height: 34, fontSize: 12 }}
                      >
                        {emp.avatar_initials}
                      </div>
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
                    <div className="tabular-nums" style={{ fontWeight: 600 }}>{formatInr(emp.base_salary_inr)}</div>
                    <div className="tabular-nums" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {String(emp.join_date || '').slice(0, 10)}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${emp.status === 'active' ? 'status-Approved' : 'status-Dismissed'}`}>
                      {emp.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => { setEditingEmp(emp); setEmpModalOpen(true); }}
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => { setDeleteError(''); setDeleteTarget({ type: 'employee', item: emp }); }}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
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
        onClose={() => setDeptModalOpen(false)}
        onSaved={handleDepartmentSaved}
      />

      <EmployeeFormModal
        isOpen={empModalOpen}
        initialEmployee={editingEmp}
        departments={departments}
        suggestedCode={getNextEmpCode(employees)}
        onClose={() => setEmpModalOpen(false)}
        onSaved={handleEmployeeSaved}
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
    </div>
  );
}

