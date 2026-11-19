import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import '../components/chartSetup';
import {
  Award,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Filter,
  Globe,
  KeyRound,
  Layers,
  Mail,
  Phone,
  RotateCcw,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { api, compressImageToMinimalResolution, formatDate, formatInr } from '../api/client';
import EmployeeAvatar from '../components/EmployeeAvatar';
import RewardlyLoader from '../components/RewardlyLoader';

function SkeletonBox({ width = '100%', height = 16, style = {}, borderRadius = 8 }) {
  return (
    <div
      className="skeleton-box"
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

export default function EmployeePortalPage({
  employee: initialEmployee,
  onLogout,
  onSwitchToManager,
  showToast,
}) {
  const [employee, setEmployee] = useState(initialEmployee);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState('');
  const fileInputRef = useRef(null);

  // Change password modal/inline state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState({ error: '', success: '' });
  const [savingPwd, setSavingPwd] = useState(false);

  const empCode = (employee?.emp_code || '').trim().toUpperCase();

  // Dashboard Period Filter States
  const [dateBounds, setDateBounds] = useState({
    minDate: '2026-07-12',
    maxDate: '2026-11-18',
  });
  const [filterMode, setFilterMode] = useState('month'); // default to 'month' for monthly sales target tracking
  const [selectedMonth, setSelectedMonth] = useState('2026-11');
  const [selectedQuarter, setSelectedQuarter] = useState('2026-Q4');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [dateRange, setDateRange] = useState({
    startDate: '2026-11-01',
    endDate: '2026-11-19',
  });

  // Fetch shop meta for active date bounds
  useEffect(() => {
    api.getMeta?.()
      .then((meta) => {
        if (meta?.dateBounds) {
          setDateBounds(meta.dateBounds);
        }
      })
      .catch(() => { });
  }, []);

  // Compute preset dates for each filter category
  function getPresetDates(
    mode,
    { month = selectedMonth, quarter = selectedQuarter, year = selectedYear } = {}
  ) {
    const minD = dateBounds.minDate || '2026-07-12';
    const maxD = dateBounds.maxDate || '2026-11-18';

    if (mode === 'today') {
      const todayStr = maxD || new Date().toISOString().slice(0, 10);
      return { startDate: todayStr, endDate: todayStr };
    }
    if (mode === 'full') {
      return { startDate: minD, endDate: maxD };
    }
    if (mode === 'month') {
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const s = `${month}-01`;
      const e = `${month}-${String(lastDay).padStart(2, '0')}`;
      return {
        startDate: s < minD ? minD : s,
        endDate: e > maxD ? maxD : e,
      };
    }
    if (mode === 'quarter') {
      const [yStr, qStr] = quarter.split('-');
      const y = parseInt(yStr, 10);
      const quarterMap = {
        Q1: { s: `${y}-01-01`, e: `${y}-03-31` },
        Q2: { s: `${y}-04-01`, e: `${y}-06-30` },
        Q3: { s: `${y}-07-01`, e: `${y}-09-30` },
        Q4: { s: `${y}-10-01`, e: `${y}-12-31` },
      };
      const bounds = quarterMap[qStr] || quarterMap.Q4;
      return {
        startDate: bounds.s < minD ? minD : bounds.s,
        endDate: bounds.e > maxD ? maxD : bounds.e,
      };
    }
    if (mode === 'year') {
      const s = `${year}-01-01`;
      const e = `${year}-12-31`;
      return {
        startDate: s < minD ? minD : s,
        endDate: e > maxD ? maxD : e,
      };
    }
    return { startDate: dateRange.startDate || minD, endDate: dateRange.endDate || maxD };
  }

  function handleModeSelect(newMode) {
    setLoadingDetail(true);
    setFilterMode(newMode);
    if (newMode !== 'custom') {
      const dates = getPresetDates(newMode);
      setDateRange(dates);
    }
  }

  function handleMonthChange(newMonth) {
    setLoadingDetail(true);
    setSelectedMonth(newMonth);
    setFilterMode('month');
    const dates = getPresetDates('month', { month: newMonth });
    setDateRange(dates);
  }

  function handleQuarterChange(newQuarter) {
    setLoadingDetail(true);
    setSelectedQuarter(newQuarter);
    setFilterMode('quarter');
    const dates = getPresetDates('quarter', { quarter: newQuarter });
    setDateRange(dates);
  }

  function handleYearChange(newYear) {
    setLoadingDetail(true);
    setSelectedYear(newYear);
    setFilterMode('year');
    const dates = getPresetDates('year', { year: newYear });
    setDateRange(dates);
  }

  function handleCustomStart(val) {
    setLoadingDetail(true);
    setFilterMode('custom');
    setDateRange((prev) => ({
      ...prev,
      startDate: val,
      endDate: prev.endDate || dateBounds.maxDate,
    }));
  }

  function handleCustomEnd(val) {
    setLoadingDetail(true);
    setFilterMode('custom');
    setDateRange((prev) => ({
      ...prev,
      startDate: prev.startDate || dateBounds.minDate,
      endDate: val,
    }));
  }

  // Load employee analytics details (with optional silent background refresh for live sync)
  const fetchMetrics = useCallback((silent = false) => {
    if (!employee?.id) return;
    if (!silent) setLoadingDetail(true);
    api
      .getEmployeeDetail(employee.id, {
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      })
      .then((data) => {
        setDetail(data);
        if (data?.employee) {
          setEmployee((prev) => ({ ...prev, ...data.employee }));
        }
      })
      .catch((err) => {
        if (!silent) showToast?.(err.message || 'Failed to load performance metrics.');
      })
      .finally(() => {
        if (!silent) setLoadingDetail(false);
      });
  }, [employee?.id, dateRange.startDate, dateRange.endDate, showToast]);

  useEffect(() => {
    fetchMetrics(false);
  }, [fetchMetrics]);

  // Real-time live synchronization for sales, counter billing, and customer feedback
  useEffect(() => {
    function handleSaleCreated() {
      fetchMetrics(true);
    }
    function handleFeedbackCreated() {
      fetchMetrics(true);
    }
    function handleStorage(e) {
      if (
        e.key === 'rewardly:last_sale_timestamp' ||
        e.key === 'rewardly:last_feedback_timestamp'
      ) {
        fetchMetrics(true);
      }
    }
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        fetchMetrics(true);
      }
    }

    // Fast 5-second polling when tab is active to capture cross-device/network cashier sales live
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMetrics(true);
      }
    }, 5000);

    window.addEventListener('rewardly:sale_created', handleSaleCreated);
    window.addEventListener('rewardly:feedback_created', handleFeedbackCreated);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      window.removeEventListener('rewardly:sale_created', handleSaleCreated);
      window.removeEventListener('rewardly:feedback_created', handleFeedbackCreated);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchMetrics]);

  // Handle Minimal-Resolution Profile Picture Upload
  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setUploadFeedback('');
    try {
      // Compress client-side to 160x160 square WebP (~6-12KB)
      const compressed = await compressImageToMinimalResolution(file, {
        maxSize: 160,
        quality: 0.82,
      });

      // Send ultra-lightweight payload to backend (persisted into Supabase & SQLite)
      const res = await api.updateEmployeeAvatar(employee.id, compressed.dataUrl);
      if (res.success && res.employee) {
        setEmployee(res.employee);
        const feedback = `Profile photo compressed to ${compressed.sizeKb} KB (160×160 WebP) and synced to Supabase!`;
        setUploadFeedback(feedback);
        showToast?.(feedback);
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to compress or upload image.');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Handle Remove Avatar
  async function handleRemoveAvatar() {
    if (!window.confirm('Remove your profile photo and restore default initials?')) return;
    setUploadingAvatar(true);
    try {
      const res = await api.updateEmployeeAvatar(employee.id, null);
      if (res.success && res.employee) {
        setEmployee(res.employee);
        setUploadFeedback('Profile photo removed.');
        showToast?.('Profile photo removed.');
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to remove photo.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  // Handle Password Change
  async function handleChangePassword(e) {
    e.preventDefault();
    setPwdMsg({ error: '', success: '' });
    if (!newPwd || newPwd.length < 4) {
      setPwdMsg({ error: 'New password must be at least 4 characters.', success: '' });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ error: 'New passwords do not match.', success: '' });
      return;
    }

    setSavingPwd(true);
    try {
      // Use the reset endpoint with current employee info
      const res = await api.employeeResetPassword({
        emp_code: empCode,
        verification: employee.email || employee.phone,
        new_password: newPwd,
      });
      if (res.success) {
        setPwdMsg({ error: '', success: 'Password updated successfully!' });
        setTimeout(() => {
          setShowPasswordModal(false);
          setNewPwd('');
          setConfirmPwd('');
          setCurrentPwd('');
          setPwdMsg({ error: '', success: '' });
        }, 1500);
      } else {
        setPwdMsg({ error: res.error || 'Failed to update password.', success: '' });
      }
    } catch (err) {
      setPwdMsg({ error: err.message || 'Failed to change password.', success: '' });
    } finally {
      setSavingPwd(false);
    }
  }

  const scores = detail?.employee?.scores || {};
  const metrics = detail?.employee?.metrics || {};
  const recognitions = detail?.recentRecognitions || [];
  const feedbackList = detail?.recentFeedback || [];
  const monthlyProgression = detail?.monthlyProgression || [];
  const deptAnalytics = detail?.departmentAnalytics || {
    departmentName: employee?.department_name || 'Silk & Sarees',
    departmentCode: employee?.department_code || 'SILK',
    departmentTargetInr: 200000,
    monthlyDepartmentTargetInr: 200000,
    deptActualSalesInr: metrics.netSalesInr || 0,
    deptTargetAchievedPct: 100,
    employeeNetSalesInr: metrics.netSalesInr || 0,
    contributionToDeptTargetPct: 0,
    contributionToActualSalesPct: 0,
    individualTargetInr: employee?.target_monthly_sales || metrics.monthlyTargetInr || 50000,
    individualMonthlyTargetInr: employee?.target_monthly_sales || metrics.monthlyTargetInr || 50000,
    individualTargetPct: metrics.targetAchievementPct || 0,
    targetRemainingInr: Math.max(0, (employee?.target_monthly_sales || 50000) - (metrics.netSalesInr || 0)),
    transactionsCount: metrics.billsCount || 0,
    avgBillValueInr: metrics.avgBillValueInr || 0,
    employeeFirstName: (employee?.full_name || '').split(' ')[0] || 'Staff',
  };

  // Month-over-Month Improvement & Line Chart Data
  const [trendMetric, setTrendMetric] = useState('score'); // 'score' | 'sales'
  const isScoreMode = trendMetric === 'score';

  const chartLabels = monthlyProgression.map((m) => m.label || m.shortLabel);
  const chartScoreValues = monthlyProgression.map((m) => Number(m.compositeScore || 0));
  const chartSalesValues = monthlyProgression.map((m) => Number(m.netSalesInr || 0));
  const chartActiveValues = isScoreMode ? chartScoreValues : chartSalesValues;

  const lastIndex = monthlyProgression.length - 1;
  const previousMonthData = lastIndex >= 1 ? monthlyProgression[lastIndex - 1] : null;

  const currVal =
    chartActiveValues[lastIndex] ??
    (isScoreMode ? Number(scores.compositeScore || 0) : Number(metrics.netSalesInr || 0));
  const prevVal = chartActiveValues[lastIndex - 1] ?? currVal;
  const valDelta = isScoreMode
    ? Math.round((currVal - prevVal) * 10) / 10
    : currVal - prevVal;
  const isUp = valDelta > 0;
  const isDown = valDelta < 0;

  const chartThemeColor = isScoreMode ? '#7c3aed' : '#059669';

  const lineChartData = {
    labels: chartLabels.length > 0 ? chartLabels : ['Current'],
    datasets: [
      {
        label: isScoreMode ? 'Composite Score (%)' : 'Net Sales (₹)',
        data: chartActiveValues.length > 0 ? chartActiveValues : [currVal],
        borderColor: chartThemeColor,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) {
            return isScoreMode ? 'rgba(124, 58, 237, 0.12)' : 'rgba(5, 150, 105, 0.12)';
          }
          const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          grad.addColorStop(0, isScoreMode ? 'rgba(124, 58, 237, 0.28)' : 'rgba(5, 150, 105, 0.28)');
          grad.addColorStop(1, isScoreMode ? 'rgba(124, 58, 237, 0.01)' : 'rgba(5, 150, 105, 0.01)');
          return grad;
        },
        fill: true,
        tension: 0.36,
        borderWidth: 2.5,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: chartThemeColor,
        pointBorderWidth: 2.5,
        pointRadius: 4.5,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: chartThemeColor,
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e1b4b',
        titleFont: { size: 11, weight: 'bold' },
        bodyFont: { size: 11 },
        padding: 8,
        cornerRadius: 8,
        callbacks: {
          label: (item) => {
            const rawScore = chartScoreValues[item.dataIndex] ?? 0;
            const rawSales = chartSalesValues[item.dataIndex] ?? 0;
            return isScoreMode
              ? ` Score: ${rawScore}% (Sales: ${formatInr(rawSales)})`
              : ` Sales: ${formatInr(rawSales)} (Score: ${rawScore}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          font: { size: 10.5, weight: '600' },
          color: '#64748b',
        },
      },
      y: {
        beginAtZero: !isScoreMode,
        suggestedMin: isScoreMode
          ? Math.max(0, Math.floor((Math.min(...(chartScoreValues.length ? chartScoreValues : [40])) - 6) / 5) * 5)
          : 0,
        suggestedMax: isScoreMode
          ? Math.min(100, Math.ceil((Math.max(...(chartScoreValues.length ? chartScoreValues : [85])) + 6) / 5) * 5)
          : undefined,
        grid: { color: '#f1f5f9' },
        border: { display: false },
        ticks: {
          font: { size: 9.5 },
          color: '#94a3b8',
          maxTicksLimit: 4,
          callback: (val) =>
            isScoreMode
              ? `${val}%`
              : val >= 100000
                ? `₹${(val / 100000).toFixed(1)}L`
                : val >= 1000
                  ? `₹${Math.round(val / 1000)}k`
                  : `₹${val}`,
        },
      },
    },
  };

  return (
    <div className="page-container" style={{ maxWidth: 1200, paddingBottom: 60 }}>
      {/* Top Banner / Hero Card */}
      <div className="emp-portal-banner">
        <div className="emp-portal-profile">
          <div className="emp-avatar-container">
            <EmployeeAvatar
              employee={employee}
              size={84}
              style={{
                border: '3px solid #ffffff',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
              }}
            />
            <button
              type="button"
              className="emp-avatar-upload-badge"
              onClick={() => fileInputRef.current?.click()}
              title="Upload new profile picture (auto-compressed to ~8KB)"
              aria-label="Upload profile photo"
              disabled={uploadingAvatar}
            >
              <Camera size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileSelected}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 className="emp-portal-name">{employee?.full_name}</h2>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.22)',
                  backdropFilter: 'blur(6px)',
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                ID: {empCode}
              </span>
              <span
                style={{
                  background: scores.tier === 'Gold' ? '#fbbf24' : '#94a3b8',
                  color: '#1e1b4b',
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {scores.tier || 'Silver'} Tier
              </span>
            </div>

            <div className="emp-portal-meta">
              <span>{employee?.role || 'Staff Consultant'}</span>
              <span>•</span>
              <span>{employee?.department_name || 'Showroom Floor'}</span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock size={13} /> {employee?.shift || 'Morning Shift'}
              </span>
            </div>

            {uploadFeedback && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: '#a7f3d0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <CheckCircle2 size={13} /> {uploadFeedback}
              </div>
            )}
          </div>
        </div>

        {/* Composite Score in Purple Hero Banner */}
        <div className="emp-portal-composite-banner-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#e9d5ff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Loyalty  Score
            </span>

          </div>

          <div
            style={{
              fontSize: 34,
              fontWeight: 900,
              color: '#ffffff',
              margin: '4px 0 2px',
              letterSpacing: '-0.02em',
            }}
          >
            {scores.compositeScore != null ? `${scores.compositeScore}%` : '85%'}
          </div>

          <div style={{ fontSize: 12, color: '#fef08a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Award size={14} color="#fef08a" />
            <span>Rank #{detail?.employee?.rank || 1} in Showroom</span>
          </div>
        </div>
      </div>

      {/* FILTERED ANALYTICS BLOCK: Updates per period filter with skeleton loaders */}
      <div className="emp-filtered-container">
        {/* Dashboard Analytics Period Filter Bar */}
        <div className="emp-filter-card">
          <div className="emp-filter-toprow">
            <div className="emp-filter-title">
              <Filter size={16} color="#6d28d9" />
              <span>Dashboard Period Filter</span>
            </div>

            {/* Mode Selection Pills */}
            <div className="emp-filter-modes">
              <button
                type="button"
                className={`emp-filter-mode-btn ${filterMode === 'today' ? 'active' : ''}`}
                onClick={() => handleModeSelect('today')}
              >
                <Zap size={13} /> Today
              </button>

              <button
                type="button"
                className={`emp-filter-mode-btn ${filterMode === 'month' ? 'active' : ''}`}
                onClick={() => handleModeSelect('month')}
              >
                <Calendar size={13} /> Monthly
              </button>

              <button
                type="button"
                className={`emp-filter-mode-btn ${filterMode === 'quarter' ? 'active' : ''}`}
                onClick={() => handleModeSelect('quarter')}
              >
                <Layers size={13} /> Quarterly
              </button>

              <button
                type="button"
                className={`emp-filter-mode-btn ${filterMode === 'year' ? 'active' : ''}`}
                onClick={() => handleModeSelect('year')}
              >
                <Clock size={13} /> Yearly
              </button>

              <button
                type="button"
                className={`emp-filter-mode-btn ${filterMode === 'full' ? 'active' : ''}`}
                onClick={() => handleModeSelect('full')}
              >
                <Globe size={13} /> Full Time
              </button>

              <button
                type="button"
                className={`emp-filter-mode-btn ${filterMode === 'custom' ? 'active' : ''}`}
                onClick={() => handleModeSelect('custom')}
              >
                <Calendar size={13} /> Custom Dates
              </button>
            </div>
          </div>

          {/* Dynamic Sub-Row with Period Selectors & Date Range */}
          <div className="emp-filter-subrow">
            <div className="emp-filter-controls-group">
              {filterMode === 'today' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#0284c7',
                      background: '#e0f2fe',
                      padding: '4px 10px',
                      borderRadius: 8,
                    }}
                  >
                    <Zap size={12} color="#0284c7" />
                    Today&apos;s Live Sales & Shift ({formatDate(dateRange.startDate || dateBounds.maxDate)})
                  </span>
                </div>
              )}

              {filterMode === 'month' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Month:
                  </span>
                  <select
                    className="select"
                    value={selectedMonth}
                    onChange={(e) => handleMonthChange(e.target.value)}
                    style={{ padding: '5px 12px', fontSize: 12.5, fontWeight: 600 }}
                  >
                    <option value="2026-11">November 2026 (Current)</option>
                    <option value="2026-10">October 2026</option>
                    <option value="2026-09">September 2026</option>
                    <option value="2026-08">August 2026</option>
                    <option value="2026-07">July 2026</option>
                  </select>
                </div>
              )}

              {filterMode === 'quarter' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Quarter:
                  </span>
                  <select
                    className="select"
                    value={selectedQuarter}
                    onChange={(e) => handleQuarterChange(e.target.value)}
                    style={{ padding: '5px 12px', fontSize: 12.5, fontWeight: 600 }}
                  >
                    <option value="2026-Q4">Q4 2026 (Oct – Dec)</option>
                    <option value="2026-Q3">Q3 2026 (Jul – Sep)</option>
                    <option value="2026-Q2">Q2 2026 (Apr – Jun)</option>
                    <option value="2026-Q1">Q1 2026 (Jan – Mar)</option>
                  </select>
                </div>
              )}

              {filterMode === 'year' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Year:
                  </span>
                  <select
                    className="select"
                    value={selectedYear}
                    onChange={(e) => handleYearChange(e.target.value)}
                    style={{ padding: '5px 12px', fontSize: 12.5, fontWeight: 600 }}
                  >
                    <option value="2026">Year 2026 (Current)</option>
                    <option value="2025">Year 2025</option>
                  </select>
                </div>
              )}

              {/* Date Pickers */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>From:</span>
                <input
                  type="date"
                  className="emp-filter-date-input"
                  value={dateRange.startDate || dateBounds.minDate}
                  min={dateBounds.minDate}
                  max={dateRange.endDate || dateBounds.maxDate}
                  onChange={(e) => handleCustomStart(e.target.value)}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>To:</span>
                <input
                  type="date"
                  className="emp-filter-date-input"
                  value={dateRange.endDate || dateBounds.maxDate}
                  min={dateRange.startDate || dateBounds.minDate}
                  max={dateBounds.maxDate}
                  onChange={(e) => handleCustomEnd(e.target.value)}
                />
              </div>
            </div>

            {/* Active Period Badge & Status */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {loadingDetail ? (
                <span style={{ fontSize: 12, color: '#6d28d9', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span className="skeleton-box" style={{ width: 12, height: 12, borderRadius: '50%' }}></span>
                  Updating analytics...
                </span>
              ) : (
                <span className="emp-filter-active-badge">
                  <Calendar size={13} />
                  <span>
                    {formatDate(dateRange.startDate || dateBounds.minDate)} –{' '}
                    {formatDate(dateRange.endDate || dateBounds.maxDate)}
                    {detail?.activeRange?.days ? ` (${detail.activeRange.days} days)` : ''}
                  </span>
                </span>
              )}

              {filterMode !== 'full' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: 11.5, borderRadius: 8 }}
                  onClick={() => handleModeSelect('full')}
                  title="Reset to Full Time"
                >
                  Reset to Full Time
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3-Card Filtered KPI Row */}
        <div className="emp-kpi-grid-3">
          {loadingDetail ? (
            <>
              {/* Net Sales Skeleton */}
              <div className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <SkeletonBox width={120} height={14} />
                  <SkeletonBox width={60} height={14} borderRadius={12} />
                </div>
                <SkeletonBox width={150} height={30} style={{ margin: '8px 0' }} />
                <SkeletonBox width={120} height={13} />
              </div>

              {/* Customer Rating Skeleton */}
              <div className="card" style={{ padding: 18 }}>
                <div style={{ marginBottom: 10 }}>
                  <SkeletonBox width={110} height={14} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
                  <SkeletonBox width={22} height={22} borderRadius={4} />
                  <SkeletonBox width={80} height={28} />
                </div>
                <SkeletonBox width={130} height={13} />
              </div>

              {/* Attendance Skeleton */}
              <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <SkeletonBox width={140} height={14} style={{ marginBottom: 10 }} />
                  <SkeletonBox width={90} height={30} style={{ margin: '8px 0' }} />
                </div>
                <SkeletonBox width={150} height={13} />
              </div>
            </>
          ) : (
            <>
              {/* Net Sales Achieved Card */}
              <div className="card" style={{ padding: 18 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Net Sales Achieved</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#059669',
                      background: 'rgba(16, 185, 129, 0.12)',
                      padding: '2px 7px',
                      borderRadius: 12,
                    }}
                    title="Auto-updates live as bills are generated at cashier counter"
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }}></span>
                    Real-Time
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: 'var(--text)',
                    margin: '6px 0 2px',
                  }}
                >
                  {metrics.netSalesInr != null ? formatInr(metrics.netSalesInr) : '₹0'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  Target Completion: {metrics.targetAchievementPct != null ? `${metrics.targetAchievementPct}%` : (scores.salesScore != null ? `${scores.salesScore}%` : '0%')}
                  <span style={{ margin: '0 5px' }}>•</span>
                  Target: {formatInr(metrics.proRatedTargetInr || metrics.monthlyTargetInr || employee?.target_monthly_sales || scores.targetInr || 0)}
                </div>
              </div>

              {/* Customer Rating Card */}
              <div className="card" style={{ padding: 18 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Customer Rating
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: '#f59e0b',
                    margin: '6px 0 2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Star size={20} fill="#f59e0b" color="#f59e0b" />
                  <span>
                    {metrics.avgCustomerRating != null ? metrics.avgCustomerRating.toFixed(1) : '4.8'}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>
                    / 5.0
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {metrics.feedbackCount || 0} customer reviews
                </div>
              </div>

              {/* Attendance & Punctuality Card */}
              <div
                className="card"
                style={{
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                    Attendance &amp; Punctuality
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      color: '#10b981',
                      margin: '6px 0 2px',
                    }}
                  >
                    {scores.attendanceScore != null ? `${scores.attendanceScore}%` : '98%'}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {metrics.attendanceDaysPresent ?? 92} / {metrics.attendanceDaysExpected ?? 94} days
                  present
                </div>
              </div>
            </>
          )}
        </div>

        {/* Department Target Contribution & Performance Cards */}
        {loadingDetail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Department Target Contribution Skeleton */}
            <div className="card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <SkeletonBox width={220} height={18} />
                  <SkeletonBox width={120} height={14} style={{ marginTop: 6 }} />
                </div>
                <SkeletonBox width={140} height={24} borderRadius={12} />
              </div>
              <SkeletonBox width={200} height={28} style={{ margin: '14px 0 10px' }} />
              <SkeletonBox width="100%" height={8} borderRadius={999} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, marginBottom: 16 }}>
                <SkeletonBox width={130} height={12} />
                <SkeletonBox width={110} height={12} />
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
                {[1, 2, 3, 4].map((k) => (
                  <div key={k}>
                    <SkeletonBox width={100} height={12} />
                    <SkeletonBox width={80} height={20} style={{ marginTop: 4 }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Department Performance Skeleton */}
            <div className="card" style={{ padding: 22 }}>
              <SkeletonBox width={180} height={18} style={{ marginBottom: 12 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <SkeletonBox width={140} height={14} />
                  <SkeletonBox width={120} height={22} borderRadius={12} style={{ marginTop: 8 }} />
                </div>
                <SkeletonBox width={160} height={24} />
              </div>
              <SkeletonBox width={260} height={14} style={{ marginTop: 14 }} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Card 1: Department Target Contribution */}
            <div className="card" style={{ padding: 22 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                      Department Target Contribution
                    </h3>
                    {deptAnalytics.targetPeriodLabel && (
                      <span
                        style={{
                          background: '#f3e8ff',
                          color: '#7c3aed',
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 8,
                          border: '1px solid #ddd6fe',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        📅 {deptAnalytics.targetPeriodLabel}
                        {deptAnalytics.targetPeriodStartDate && deptAnalytics.targetPeriodEndDate && (
                          <span style={{ fontWeight: 500, color: '#6d28d9', marginLeft: 2 }}>
                            ({formatDate(deptAnalytics.targetPeriodStartDate)} – {formatDate(deptAnalytics.targetPeriodEndDate)})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>
                    {deptAnalytics.departmentName}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {deptAnalytics.individualTargetPct != null && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>
                      {deptAnalytics.individualTargetPct}% of individual target
                    </span>
                  )}
                  <span
                    style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 12,
                      display: 'inline-block',
                    }}
                  >
                    {deptAnalytics.contributionToDeptTargetPct}% of department target
                  </span>
                </div>
              </div>

              {/* Amount Progress */}
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: 'var(--text)',
                  margin: '10px 0 4px',
                  letterSpacing: '-0.01em',
                }}
              >
                {formatInr(deptAnalytics.employeeNetSalesInr)} / {formatInr(deptAnalytics.departmentTargetInr)}
              </div>
              {deptAnalytics.targetPeriodMonths > 1 && (
                <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600, marginBottom: 8 }}>
                  Total {deptAnalytics.targetPeriodMonths}-Month Target ({formatInr(deptAnalytics.monthlyDepartmentTargetInr)}/month)
                </div>
              )}

              {/* Progress Bar */}
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: '#f1f5f9',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, deptAnalytics.contributionToDeptTargetPct))}%`,
                    background: '#10b981',
                    borderRadius: 999,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  marginTop: 6,
                  marginBottom: 16,
                }}
              >
                <span>Employee contribution</span>
                <span>
                  Department target {deptAnalytics.targetPeriodMonths > 1 ? `(${deptAnalytics.targetPeriodMonths}m Total)` : '(Monthly)'}
                </span>
              </div>

              {/* 4-Item Metric Grid */}
              <div
                style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: 16,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Individual target {deptAnalytics.targetPeriodMonths > 1 ? `(${deptAnalytics.targetPeriodMonths}m)` : ''}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
                    {formatInr(deptAnalytics.individualTargetInr)}
                  </div>
                  {deptAnalytics.targetPeriodMonths > 1 && (
                    <div style={{ fontSize: 11, color: '#6d28d9', fontWeight: 600, marginTop: 2 }}>
                      {formatInr(deptAnalytics.individualMonthlyTargetInr)} / month
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Target remaining</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
                    {formatInr(deptAnalytics.targetRemainingInr)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Transactions</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
                    {deptAnalytics.transactionsCount}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Average bill value</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>
                    {formatInr(deptAnalytics.avgBillValueInr)}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Department Performance */}
            <div className="card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  Department Performance
                </h3>
                {deptAnalytics.targetPeriodLabel && (
                  <span
                    style={{
                      background: '#f3e8ff',
                      color: '#7c3aed',
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 8,
                      border: '1px solid #ddd6fe',
                    }}
                  >
                    📅 {deptAnalytics.targetPeriodLabel}
                  </span>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
                    Department achieved
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span
                      style={{
                        background: '#dcfce7',
                        color: '#15803d',
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: 12,
                        display: 'inline-block',
                      }}
                    >
                      {deptAnalytics.deptTargetAchievedPct}% target achieved
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: 'var(--text)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {formatInr(deptAnalytics.deptActualSalesInr)} / {formatInr(deptAnalytics.departmentTargetInr)}
                </div>
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  marginTop: 14,
                  paddingTop: 10,
                  borderTop: '1px solid var(--border)',
                }}
              >
                {deptAnalytics.employeeFirstName}&apos;s contribution to actual department sales: {deptAnalytics.contributionToActualSalesPct}%
              </div>
            </div>
          </div>
        )}

        {/* Filtered Activity Row: Feedback & Recognitions */}
        <div className="emp-portal-grid">
          {/* Customer Reviews & Feedback Card */}
          {loadingDetail ? (
            <div className="card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <SkeletonBox width={180} height={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      padding: '14px',
                      borderRadius: 12,
                      background: '#f8f9fd',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <SkeletonBox width={120} height={16} />
                        <SkeletonBox width={55} height={14} borderRadius={10} />
                      </div>
                      <SkeletonBox width={50} height={16} />
                    </div>
                    <SkeletonBox width="92%" height={14} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <SkeletonBox width={80} height={12} />
                      <SkeletonBox width={70} height={12} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 22 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  Recent Customer Feedback ({feedbackList.length})
                </h3>
              </div>

              {feedbackList.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '30px 10px',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                  }}
                >
                  No customer ratings submitted yet for your assistance.
                  <br />
                  Direct ratings will appear here as customers scan the QR code on their billing receipt.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {feedbackList.map((fb) => (
                    <div
                      key={fb.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: '#f8f9fd',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ fontSize: 13.5 }}>{fb.customer_name || 'Customer'}</strong>
                          {fb.sentiment && (
                            <span
                              className={`status-badge status-${fb.sentiment === 'Positive' ? 'Approved' : fb.sentiment === 'Neutral' ? 'Pending' : 'Rejected'}`}
                              style={{ fontSize: 10.5, padding: '1px 8px' }}
                            >
                              {fb.sentiment}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            color: '#f59e0b',
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          <Star size={14} fill="#f59e0b" />
                          <span>{fb.rating} / 5</span>
                        </div>
                      </div>

                      {/* Customer Feedback Message / Comment */}
                      {(fb.comment || fb.notes || fb.message) ? (
                        <div
                          style={{
                            margin: '8px 0 4px',
                            padding: '8px 12px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            fontSize: 12.5,
                            color: '#1e293b',
                            lineHeight: 1.45,
                          }}
                        >
                          <span style={{ color: '#6d28d9', fontWeight: 700, marginRight: 6 }}>
                            💬 Customer Message:
                          </span>
                          <span>&ldquo;{fb.comment || fb.notes || fb.message}&rdquo;</span>
                        </div>
                      ) : (
                        <div style={{ margin: '4px 0', fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          (Customer rated without written comments)
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        <span>{formatDate(fb.created_at || fb.feedback_date || fb.date)}</span>
                        {fb.channel && fb.channel.includes('[bill:') && (
                          <span style={{ color: '#6d28d9', fontWeight: 600 }}>
                            {fb.channel.match(/\[bill:\s*([^\]]+)\]/)?.[1] ? `Bill #${fb.channel.match(/\[bill:\s*([^\]]+)\]/)[1]}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recognitions Received Card */}
          {loadingDetail ? (
            <div className="card" style={{ padding: 22 }}>
              <SkeletonBox width={200} height={18} style={{ marginBottom: 16 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      padding: '14px',
                      borderRadius: 12,
                      background: '#fdf4ff',
                      border: '1px solid #f0abfc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <SkeletonBox width={140} height={16} />
                      <SkeletonBox width={70} height={14} />
                    </div>
                    <SkeletonBox width="88%" height={14} />
                    <SkeletonBox width={120} height={12} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 22 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>
                Peer &amp; Manager Recognitions ({recognitions.length})
              </h3>
              {recognitions.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                  No recognitions logged in this period.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recognitions.map((rec) => (
                    <div
                      key={rec.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: '#fdf4ff',
                        border: '1px solid #f0abfc',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <strong style={{ fontSize: 13.5, color: '#86198f' }}>
                          {rec.recognition_type} Recognition
                        </strong>
                        <span style={{ fontSize: 11.5, color: '#a21caf' }}>
                          {formatDate(rec.recognition_date || rec.date)}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#4a044e' }}>
                        {rec.message}
                      </p>
                      <div style={{ fontSize: 11.5, color: '#701a75', marginTop: 4 }}>
                        Awarded by <strong>{rec.from_name || 'Showroom Management'}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* LOWER SECTION: Month-Wise Improvement Line Chart + Profile Details (Outside the filter block) */}
      <div className="emp-portal-grid" style={{ marginTop: 24 }}>
        {/* Left: Month-Wise Improvement Line Chart */}
        <div>
          <div className="card" style={{ padding: 22 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 12,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <TrendingUp size={15} color={chartThemeColor} />
                  Month-Wise Improvement Line Chart
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: isUp ? '#10b981' : isDown ? '#f59e0b' : chartThemeColor,
                    }}
                  >
                    {isScoreMode
                      ? isUp
                        ? `+${valDelta}%`
                        : `${valDelta}%`
                      : isUp
                        ? `+${formatInr(valDelta)}`
                        : `${formatInr(valDelta)}`}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {previousMonthData
                      ? `MoM vs ${previousMonthData.label} (${isScoreMode ? `${prevVal}%` : formatInr(prevVal)})`
                      : 'Tracking showroom trajectory'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Metric Switcher Pills */}
                <div
                  style={{
                    display: 'inline-flex',
                    background: '#f1f5f9',
                    padding: 2,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setTrendMetric('score')}
                    style={{
                      border: 'none',
                      background: isScoreMode ? '#ffffff' : 'transparent',
                      color: isScoreMode ? '#6d28d9' : 'var(--text-muted)',
                      fontWeight: isScoreMode ? 700 : 500,
                      padding: '3px 9px',
                      borderRadius: 6,
                      fontSize: 11,
                      cursor: 'pointer',
                      boxShadow: isScoreMode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Score %
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendMetric('sales')}
                    style={{
                      border: 'none',
                      background: !isScoreMode ? '#ffffff' : 'transparent',
                      color: !isScoreMode ? '#059669' : 'var(--text-muted)',
                      fontWeight: !isScoreMode ? 700 : 500,
                      padding: '3px 9px',
                      borderRadius: 6,
                      fontSize: 11,
                      cursor: 'pointer',
                      boxShadow: !isScoreMode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Sales ₹
                  </button>
                </div>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 700,
                    background: isUp ? '#ecfdf5' : isDown ? '#fffbeb' : '#f5f3ff',
                    color: isUp ? '#065f46' : isDown ? '#b45309' : '#6d28d9',
                  }}
                >
                  {isUp ? (
                    <>
                      <TrendingUp size={12} /> Improving
                    </>
                  ) : isDown ? (
                    <>
                      <TrendingDown size={12} /> Needs Focus
                    </>
                  ) : (
                    '⚖️ Stable'
                  )}
                </span>
              </div>
            </div>

            {/* Responsive Line Chart */}
            <div
              style={{
                height: 160,
                width: '100%',
                position: 'relative',
                marginTop: 8,
                paddingTop: 8,
                borderTop: '1px solid var(--border)',
              }}
            >
              <Line data={lineChartData} options={lineChartOptions} />
            </div>
          </div>
        </div>

        {/* Right: Profile Details */}
        <div>

          {/* Profile Details Card */}
          <div className="card" style={{ padding: 22 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <User size={16} color="#6d28d9" /> Profile Details
              </h4>
              <span
                style={{
                  fontSize: 11.5,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: '#ede9fe',
                  color: '#6d28d9',
                  fontWeight: 700,
                }}
              >
                {empCode}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Role</span>
                <strong>{employee?.role || 'Staff Consultant'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Department</span>
                <strong>{employee?.department_name || 'Silk & Sarees'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Monthly Target</span>
                <strong style={{ color: 'var(--primary)', fontWeight: 700 }}>
                  {formatInr(employee?.target_monthly_sales || metrics.monthlyTargetInr || scores.monthlyTargetInr || 0)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Shift Timings</span>
                <strong>{employee?.shift || 'Morning (10:00 - 19:30)'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email</span>
                <strong>{employee?.email || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Phone</span>
                <strong>{employee?.phone || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Joined Date</span>
                <strong>{formatDate(employee?.join_date) || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Photo Optimization</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>≤ 15 KB WebP</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 10,
                  marginTop: 2,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Password</span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setShowPasswordModal(true)}
                  style={{ fontSize: 12.5 }}
                >
                  Change Password
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Dialog */}
      {showPasswordModal && (
        <div className="modal-backdrop" onClick={() => setShowPasswordModal(false)}>
          <div
            className="card"
            style={{
              maxWidth: 400,
              width: '100%',
              padding: 24,
              borderRadius: 20,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>Update Password</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--text-muted)' }}>
              Set a secure new password for Employee ID <strong>{empCode}</strong>.
            </p>

            {pwdMsg.error && (
              <div className="error-banner" style={{ marginBottom: 12 }}>
                {pwdMsg.error}
              </div>
            )}
            {pwdMsg.success && (
              <div
                style={{
                  marginBottom: 12,
                  padding: '8px 12px',
                  background: '#ecfdf5',
                  color: '#065f46',
                  borderRadius: 8,
                  fontSize: 12.5,
                }}
              >
                {pwdMsg.success}
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="field-label" htmlFor="portal-new-pwd">
                  New Password
                </label>
                <input
                  id="portal-new-pwd"
                  type="password"
                  className="input"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Min 4 characters"
                  required
                  minLength={4}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 18 }}>
                <label className="field-label" htmlFor="portal-conf-pwd">
                  Confirm New Password
                </label>
                <input
                  id="portal-conf-pwd"
                  type="password"
                  className="input"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={savingPwd}
                >
                  {savingPwd ? 'Updating...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

