import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  QrCode,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import QRCode from 'qrcode';
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
  const qrCanvasRef = useRef(null);

  // Change password modal/inline state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState({ error: '', success: '' });
  const [savingPwd, setSavingPwd] = useState(false);

  const empCode = (employee?.emp_code || '').trim().toUpperCase();
  const feedbackUrl =
    empCode && typeof window !== 'undefined'
      ? `${window.location.origin}/feedback/${encodeURIComponent(empCode)}`
      : '';

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

  // Render QR Code to canvas
  useEffect(() => {
    if (!feedbackUrl || !qrCanvasRef.current) return;
    QRCode.toCanvas(
      qrCanvasRef.current,
      feedbackUrl,
      {
        width: 160,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#1e1b4b', light: '#ffffff' },
      },
      (err) => {
        if (err) console.error('Failed to generate QR code', err);
      }
    );
  }, [feedbackUrl]);

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

  // Download High-Resolution Printable Standee QR Poster
  function downloadQrPoster() {
    if (!empCode) return;
    const offscreen = document.createElement('canvas');
    const width = 800;
    const height = 1000;
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#f5f3ff');
    grad.addColorStop(1, '#ffffff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Header banner
    ctx.fillStyle = '#6d28d9';
    ctx.fillRect(0, 0, width, 140);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Rate My Service Today', width / 2, 70);

    ctx.font = '500 20px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('Kaveri Silks & Textiles • Staff Feedback', width / 2, 108);

    // Employee Name & Code
    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 34px Inter, sans-serif';
    ctx.fillText(employee?.full_name || 'Staff Member', width / 2, 215);

    ctx.fillStyle = '#6d28d9';
    ctx.font = '600 22px Inter, sans-serif';
    ctx.fillText(
      `${employee?.role || 'Textile Consultant'} • ID: ${empCode}`,
      width / 2,
      252
    );

    // Generate high-res QR code
    QRCode.toCanvas(
      offscreen,
      feedbackUrl,
      {
        width: 380,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#1e1b4b', light: '#ffffff' },
      },
      (err) => {
        if (err) return console.error(err);

        // Frame card behind QR
        const qrCanvas = document.createElement('canvas');
        QRCode.toCanvas(
          qrCanvas,
          feedbackUrl,
          { width: 380, margin: 1, color: { dark: '#1e1b4b', light: '#ffffff' } },
          (err2) => {
            if (!err2) {
              ctx.fillStyle = '#ffffff';
              ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
              ctx.shadowBlur = 24;
              ctx.shadowOffsetY = 8;
              ctx.beginPath();
              ctx.roundRect((width - 420) / 2, 290, 420, 420, 24);
              ctx.fill();
              ctx.shadowColor = 'transparent';

              ctx.drawImage(qrCanvas, (width - 380) / 2, 310);

              // Instructions
              ctx.fillStyle = '#141829';
              ctx.font = 'bold 24px Inter, sans-serif';
              ctx.fillText('Scan with Any Phone Camera', width / 2, 770);

              ctx.font = '500 18px Inter, sans-serif';
              ctx.fillStyle = '#646b82';
              ctx.fillText('No app install required • Takes 10 seconds', width / 2, 805);

              // Footer branding
              ctx.font = 'bold 20px Inter, sans-serif';
              ctx.fillStyle = '#6d28d9';
              ctx.fillText('Powered by Rewardly AI', width / 2, 930);

              const link = document.createElement('a');
              link.download = `Rewardly-Feedback-QR-${empCode}.png`;
              link.href = offscreen.toDataURL('image/png');
              link.click();
              showToast?.(`Downloaded QR Standee for ${empCode}`);
            }
          }
        );
      }
    );
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

        {/* Action Controls */}
        <div className="emp-portal-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderColor: 'rgba(255, 255, 255, 0.3)',
            }}
          >
            <Camera size={14} />
            {uploadingAvatar ? 'Compressing...' : 'Change Photo'}
          </button>

          {(employee?.avatar_url || employee?.avatar_color?.startsWith('data:image/')) && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleRemoveAvatar}
              disabled={uploadingAvatar}
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#fee2e2',
                borderColor: 'rgba(239, 68, 68, 0.4)',
              }}
              title="Remove profile picture"
            >
              <Trash2 size={13} />
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowPasswordModal(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderColor: 'rgba(255, 255, 255, 0.3)',
            }}
          >
            <KeyRound size={14} />
            Change Password
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onSwitchToManager}
            style={{
              background: '#ffffff',
              color: '#6d28d9',
              fontWeight: 700,
            }}
          >
            Manager Dashboard
          </button>

          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={onLogout}
            title="Log out"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="emp-portal-grid">
        {/* Left Column: Metrics & Feedback */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Key Metric Tiles */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 14,
            }}
          >
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

            <div className="card" style={{ padding: 18 }}>
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
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {metrics.attendanceDaysPresent ?? 92} / {metrics.attendanceDaysExpected ?? 94} days present
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
              <a
                href={feedbackUrl}
                target="_blank"
                rel="noreferrer"
                className="link-btn"
                style={{ fontSize: 12 }}
              >
                Preview Mobile Form <ExternalLink size={12} />
              </a>
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
                No customer ratings submitted yet for your QR code.
                <br />
                Display your counter standee QR code to start receiving direct feedback!
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

        {/* Right Column: Customer Feedback QR Code Standee */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card emp-qr-card">
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#ede9fe',
                color: '#6d28d9',
                margin: '0 auto 8px',
              }}
            >
              <QrCode size={22} />
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>My Counter Feedback QR</h3>
            <p style={{ margin: '4px 0 12px', fontSize: 12.5, color: 'var(--text-muted)' }}>
              Customers can scan this code to rate your service directly on their smartphones.
            </p>

            <div className="emp-qr-box">
              <canvas ref={qrCanvasRef} style={{ display: 'block', borderRadius: 8 }} />
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: '#6d28d9' }}>
              Employee ID: {empCode}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 16 }}>
              No app required • Instant anonymous mobile form
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={downloadQrPoster}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Download size={15} /> Download Printable QR Standee (PNG)
              </button>

              <a
                href={feedbackUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
              >
                <ExternalLink size={14} /> Open Customer Feedback Page
              </a>
            </div>
          </div>

          {/* Profile & Shift Overview Card */}
          <div className="card" style={{ padding: 22 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Profile Details</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email</span>
                <strong>{employee?.email || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Phone</span>
                <strong>{employee?.phone || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Department</span>
                <strong>{employee?.department_name || 'Silk & Sarees'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Joined Date</span>
                <strong>{formatDate(employee?.join_date) || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Photo Optimization</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>≤ 15 KB WebP</span>
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

