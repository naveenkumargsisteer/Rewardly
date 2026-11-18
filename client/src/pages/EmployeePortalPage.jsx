import React, { useEffect, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import '../components/chartSetup';
import {
  Award,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  KeyRound,
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
} from 'lucide-react';
import { api, compressImageToMinimalResolution, formatDate, formatInr } from '../api/client';
import EmployeeAvatar from '../components/EmployeeAvatar';
import RewardlyLoader from '../components/RewardlyLoader';

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

  // Load employee analytics details
  useEffect(() => {
    if (!employee?.id) return;
    setLoadingDetail(true);
    api
      .getEmployeeDetail(employee.id, {})
      .then((data) => {
        setDetail(data);
        if (data?.employee) {
          setEmployee((prev) => ({ ...prev, ...data.employee }));
        }
      })
      .catch((err) => {
        showToast?.(err.message || 'Failed to load performance metrics.');
      })
      .finally(() => setLoadingDetail(false));
  }, [employee?.id, showToast]);

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
      </div>

      {/* Main Grid */}
      <div className="emp-portal-grid">
        {/* Left Column: Metrics & Feedback */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Key Metric Tiles & Month-Wise Improvement Analytics */}
          <div className="emp-kpi-grid">
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                Composite Score
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: '#6d28d9',
                  margin: '6px 0 2px',
                }}
              >
                {scores.compositeScore != null ? `${scores.compositeScore}%` : '85%'}
              </div>
              <div style={{ fontSize: 11.5, color: '#10b981', fontWeight: 600 }}>
                Rank #{detail?.employee?.rank || 1} in Showroom
              </div>
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                Net Sales Achieved
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: 'var(--text)',
                  margin: '6px 0 2px',
                }}
              >
                {metrics.netSalesInr != null ? formatInr(metrics.netSalesInr) : '₹12,40,000'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                Target Completion: {scores.salesScore != null ? `${scores.salesScore}%` : '96%'}
              </div>
            </div>

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

            {/* Month-Wise Improvement Line Chart Card */}
            <div className="card emp-kpi-improvement-card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 6,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <TrendingUp size={14} color={chartThemeColor} />
                    Month-Wise Improvement Line Chart
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3 }}>
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
                  height: 105,
                  width: '100%',
                  position: 'relative',
                  marginTop: 6,
                  paddingTop: 4,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <Line data={lineChartData} options={lineChartOptions} />
              </div>
            </div>
          </div>

          {/* Customer Reviews & Feedback Card */}
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

            {loadingDetail ? (
              <RewardlyLoader variant="compact" message="Loading customer feedback..." />
            ) : feedbackList.length === 0 ? (
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
                      <strong style={{ fontSize: 13.5 }}>{fb.customer_name || 'Customer'}</strong>
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
                    {fb.notes && (
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: '#334155' }}>
                        "{fb.notes}"
                      </p>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {formatDate(fb.created_at || fb.date)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recognitions Received */}
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
        </div>

        {/* Right Column: Profile Overview & Performance Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

          {/* Performance Targets & Weightage */}
          <div className="card" style={{ padding: 22 }}>
            <h4
              style={{
                margin: '0 0 14px',
                fontSize: 15,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Target size={16} color="#059669" /> Score Weightage &amp; Goals
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12.5 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sales Target (40%)</span>
                  <strong>{scores.salesScore != null ? `${scores.salesScore}%` : '96%'}</strong>
                </div>
                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(scores.salesScore || 96, 100)}%`,
                      background: '#6d28d9',
                      borderRadius: 99,
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Customer Feedback (40%)</span>
                  <strong>{scores.feedbackScore != null ? `${scores.feedbackScore}%` : '95%'}</strong>
                </div>
                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(scores.feedbackScore || 95, 100)}%`,
                      background: '#f59e0b',
                      borderRadius: 99,
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Attendance &amp; Punctuality (20%)</span>
                  <strong>{scores.attendanceScore != null ? `${scores.attendanceScore}%` : '98%'}</strong>
                </div>
                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(scores.attendanceScore || 98, 100)}%`,
                      background: '#10b981',
                      borderRadius: 99,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 6,
                  padding: '10px 12px',
                  background: '#f8fafc',
                  borderRadius: 10,
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                Customer feedback is collected via QR code on printed sales receipts. High ratings
                directly boost your composite score and monthly incentive tier!
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

