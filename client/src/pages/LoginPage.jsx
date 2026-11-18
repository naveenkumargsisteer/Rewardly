import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  RotateCcw,
  User,
} from 'lucide-react';
import { api, getRoleCategory } from '../api/client';

export default function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'reset'
  const [empCode, setEmpCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Reset password states
  const [resetVerification, setResetVerification] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function handleLogin(e) {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const code = empCode.trim().toUpperCase();
    if (!code) {
      setErrorMsg('Please enter your Employee ID (Username).');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.employeeLogin({ emp_code: code, password });
      if (res.success && res.employee) {
        const roleCat = res.employee.role_category || getRoleCategory(res.employee.role, res.employee.emp_code);
        const emp = { ...res.employee, role_category: roleCat };
        onLoginSuccess(emp, res.isDefaultPassword);
      } else {
        setErrorMsg(res.error || 'Invalid credentials.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const code = empCode.trim().toUpperCase();
    if (!code) {
      setErrorMsg('Please enter your Employee ID.');
      return;
    }
    if (!resetVerification.trim()) {
      setErrorMsg('Please enter your registered Email or Phone number for verification.');
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      setErrorMsg('New password must be at least 4 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.employeeResetPassword({
        emp_code: code,
        verification: resetVerification.trim(),
        new_password: newPassword,
      });
      if (res.success) {
        setSuccessMsg('Password reset successfully! You can now log in with your new password.');
        setPassword(newPassword);
        setMode('login');
      } else {
        setErrorMsg(res.error || 'Password reset failed.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Verification failed. Please check registered details.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-gateway-shell">
      <div className="login-bg-overlay" aria-hidden="true" />
      <div className="login-gateway-card" style={{ maxWidth: 440 }}>
        {/* Brand Header */}
        <div className="login-gateway-header" style={{ padding: '32px 32px 24px' }}>
          <div className="login-logo-wrapper">
            <img src="/rewardly-logo.png" alt="Rewardly" className="login-logo-img" />
          </div>
          <h1 className="login-title">Kaveri Silks &amp; Textiles</h1>
          <p className="login-subtitle">
            {mode === 'login'
              ? 'Sign in with your Employee ID to access your workspace'
              : 'Verify identity and reset your showroom password'}
          </p>
        </div>

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="error-banner" style={{ margin: '16px 24px 0' }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            className="card"
            style={{
              margin: '16px 24px 0',
              padding: '10px 14px',
              background: '#ecfdf5',
              borderColor: '#a7f3d0',
              color: '#065f46',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
            }}
          >
            <CheckCircle2 size={16} color="#059669" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        {mode === 'login' ? (
          <form className="login-gateway-form" onSubmit={handleLogin} style={{ padding: '24px 28px 32px' }}>
            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="field-label" htmlFor="gateway-emp-id">
                Employee ID
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="gateway-emp-id"
                  type="text"
                  className="input"
                  value={empCode}
                  onChange={(e) => setEmpCode(e.target.value)}
                  placeholder="Enter your Employee ID"
                  autoFocus
                  required
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontWeight: 700,
                    paddingLeft: 38,
                  }}
                />
                <User
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 12, top: 12, pointerEvents: 'none' }}
                />
              </div>

            </div>

            <div className="form-group" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="field-label" htmlFor="gateway-pwd">
                  Password
                </label>
                <button
                  type="button"
                  className="link-btn"
                  style={{ fontSize: 11.5 }}
                  onClick={() => {
                    setMode('reset');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="input-with-toggle" style={{ position: 'relative' }}>
                <input
                  id="gateway-pwd"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  style={{ paddingLeft: 38 }}
                />
                <Lock
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 12, top: 12, pointerEvents: 'none' }}
                />
                <button
                  type="button"
                  className="toggle-pwd-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '13px 18px',
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 12,
              }}
            >
              <LogIn size={16} />
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        ) : (
          /* Password Reset Mode */
          <form className="login-gateway-form" onSubmit={handleResetPassword} style={{ padding: '24px 28px 32px' }}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="field-label" htmlFor="reset-emp-id">
                Employee ID
              </label>
              <input
                id="reset-emp-id"
                type="text"
                className="input"
                value={empCode}
                onChange={(e) => setEmpCode(e.target.value)}
                placeholder="e.g. RW002 or ADMIN01"
                required
                style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="field-label" htmlFor="reset-verification">
                Registered Email or Phone Number
              </label>
              <input
                id="reset-verification"
                type="text"
                className="input"
                value={resetVerification}
                onChange={(e) => setResetVerification(e.target.value)}
                placeholder="e.g. employee@kaverisilks.in or phone digits"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="field-label" htmlFor="reset-new-pwd">
                New Password
              </label>
              <div className="input-with-toggle">
                <input
                  id="reset-new-pwd"
                  type={showNewPassword ? 'text' : 'password'}
                  className="input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 4 characters"
                  required
                  minLength={4}
                />
                <button
                  type="button"
                  className="toggle-pwd-btn"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label="Toggle password visibility"
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="field-label" htmlFor="reset-conf-pwd">
                Confirm New Password
              </label>
              <input
                id="reset-conf-pwd"
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '13px 18px',
                fontSize: 15,
                borderRadius: 12,
              }}
            >
              <RotateCcw size={16} />
              {loading ? 'Verifying & Updating...' : 'Reset Password & Proceed'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                style={{ fontSize: 12.5 }}
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
