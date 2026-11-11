import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { X, Search, ArrowLeft, Award, Calculator } from 'lucide-react';
import './chartSetup';
import { api, formatCompactInr, formatInr } from '../api/client';

export default function EmployeesModal({
  isOpen,
  initialEmployeeId,
  employees,
  departments,
  startDate,
  endDate,
  onClose,
  onOpenRecognizeFor,
}) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(initialEmployeeId || null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    setSelectedId(initialEmployeeId || null);
  }, [initialEmployeeId, isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    api.getEmployeeDetail(selectedId, { startDate, endDate })
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, selectedId, startDate, endDate]);

  if (!isOpen) return null;

  const filtered = (employees || []).filter((e) => {
    const matchDept = deptFilter === 'all' || e.department_code === deptFilter;
    const q = search.trim().toLowerCase();
    const matchQ = !q || e.full_name.toLowerCase().includes(q) || e.emp_code.toLowerCase().includes(q) || e.role.toLowerCase().includes(q);
    return matchDept && matchQ;
  });

  const tierClass = (tier) => (tier === 'Gold' ? 'tier-Gold' : tier === 'Silver' ? 'tier-Silver' : 'tier-Needs');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {selectedId && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft size={14} />
                All 30 Employees
              </button>
            )}
            <div>
              <strong style={{ fontSize: 16 }}>
                {selectedId && detail?.employee
                  ? `${detail.employee.full_name} (${detail.employee.emp_code}) — Performance Report`
                  : `Showroom Employee Leaderboard (${employees?.length || 0} Employees)`}
              </strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Filtered Window: {startDate} to {endDate}
              </div>
            </div>
          </div>

          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {selectedId ? (
            loadingDetail || !detail ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading employee report...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      className="avatar"
                      style={{ width: 48, height: 48, fontSize: 16, background: detail.employee.avatar_color }}
                    >
                      {detail.employee.avatar_initials}
                    </span>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>
                        #{detail.employee.rank} {detail.employee.full_name}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {detail.employee.role} • {detail.employee.department_name} • {detail.employee.shift}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`status-badge ${tierClass(detail.employee.scores.tier)}`}>
                      {detail.employee.scores.tier} Tier • {detail.employee.scores.compositeScore}%
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => onOpenRecognizeFor(detail.employee.id)}
                    >
                      <Award size={14} />
                      Recognize Staff
                    </button>
                  </div>
                </div>

                {/* Manual Calculation Formula Verification Box */}
                <div className="formula-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
                    <Calculator size={15} />
                    Transparent Score Validation (Manual Formula Check)
                  </div>
                  <div className="tabular-nums">{detail.employee.formulaBreakdown.formulaText}</div>
                </div>

                <div className="kpi-grid">
                  <div className="kpi-card">
                    <div className="kpi-label">Net Sales</div>
                    <div className="kpi-value tabular-nums" style={{ fontSize: 21 }}>
                      {formatCompactInr(detail.employee.metrics.netSalesInr)}
                    </div>
                    <div className="emp-meta">
                      Target: {detail.employee.metrics.targetAchievementPct}% • {detail.employee.metrics.billsCount} bills
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Attendance Score</div>
                    <div className="kpi-value tabular-nums" style={{ fontSize: 21 }}>
                      {detail.employee.scores.attendanceScore}%
                    </div>
                    <div className="emp-meta">
                      {detail.employee.metrics.presentDays} present • {detail.employee.metrics.lateDays} late • {detail.employee.metrics.leaveDays} leave
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Customer Rating</div>
                    <div className="kpi-value tabular-nums" style={{ fontSize: 21 }}>
                      {detail.employee.metrics.avgRating} ★
                    </div>
                    <div className="emp-meta">
                      {detail.employee.metrics.feedbackCount} verified customer reviews
                    </div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Recognitions</div>
                    <div className="kpi-value tabular-nums" style={{ fontSize: 21 }}>
                      {detail.employee.metrics.recognitionCount}
                    </div>
                    <div className="emp-meta">
                      {detail.employee.metrics.recognitionPoints} loyalty points earned
                    </div>
                  </div>
                </div>

                <div className="charts-grid-2">
                  <div className="card">
                    <strong style={{ fontSize: 14, display: 'block', marginBottom: 10 }}>
                      Monthly Performance Trajectory
                    </strong>
                    <div style={{ height: 180 }}>
                      <Bar
                        data={{
                          labels: detail.monthlyProgression.map((m) => m.label),
                          datasets: [
                            {
                              label: 'Composite Score %',
                              data: detail.monthlyProgression.map((m) => m.compositeScore),
                              backgroundColor: '#7C3AED',
                              borderRadius: 6,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: { y: { beginAtZero: true, max: 100 } },
                        }}
                      />
                    </div>
                  </div>

                  <div className="card">
                    <strong style={{ fontSize: 14, display: 'block', marginBottom: 10 }}>
                      Recent Customer Feedback & Praise
                    </strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                      {detail.recentFeedback.slice(0, 4).map((fb) => (
                        <div
                          key={fb.id}
                          style={{ padding: 8, borderRadius: 8, background: '#f8f9fd', fontSize: 12 }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                            <span>{fb.customer_name}</span>
                            <span>{fb.rating}★ • {fb.feedback_date}</span>
                          </div>
                          <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{fb.comment}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
                    Recent Sales Activity ({detail.recentSales.length} latest days)
                  </strong>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Category</th>
                          <th>Bills</th>
                          <th>Items</th>
                          <th>Gross (₹)</th>
                          <th>Net Sales (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.recentSales.slice(0, 6).map((s) => (
                          <tr key={s.id} style={{ cursor: 'default' }}>
                            <td>{s.sale_date}</td>
                            <td>{s.category}</td>
                            <td>{s.bills_count}</td>
                            <td>{s.items_sold}</td>
                            <td className="tabular-nums">{formatInr(s.gross_amount_inr)}</td>
                            <td className="tabular-nums"><strong>{formatInr(s.net_amount_inr)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                  <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', paddingLeft: 32 }}
                    placeholder="Search Indian employee name, code (RW001), or role..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="select"
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                >
                  <option value="all">All Departments (30)</option>
                  {(departments || []).map((d) => (
                    <option key={d.id} value={d.code}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Net Sales</th>
                      <th>Target %</th>
                      <th>Attendance</th>
                      <th>Rating</th>
                      <th>Recognitions</th>
                      <th>Score</th>
                      <th>Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((emp) => (
                      <tr key={emp.id} onClick={() => setSelectedId(emp.id)}>
                        <td><strong>#{emp.rank}</strong></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="avatar" style={{ background: emp.avatar_color, width: 28, height: 28, fontSize: 11 }}>
                              {emp.avatar_initials}
                            </span>
                            <div>
                              <div style={{ fontWeight: 700 }}>{emp.full_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {emp.emp_code} • {emp.role}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{emp.department_name}</td>
                        <td className="tabular-nums"><strong>{formatCompactInr(emp.metrics.netSalesInr)}</strong></td>
                        <td className="tabular-nums">{emp.metrics.targetAchievementPct}%</td>
                        <td className="tabular-nums">{emp.scores.attendanceScore}%</td>
                        <td className="tabular-nums">{emp.metrics.avgRating}★</td>
                        <td className="tabular-nums">{emp.metrics.recognitionCount} ({emp.metrics.recognitionPoints} pts)</td>
                        <td className="tabular-nums">
                          <strong style={{ color: 'var(--primary)' }}>{emp.scores.compositeScore}%</strong>
                        </td>
                        <td>
                          <span className={`status-badge ${tierClass(emp.scores.tier)}`}>
                            {emp.scores.tier}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

