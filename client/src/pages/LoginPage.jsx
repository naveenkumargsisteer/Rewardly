import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  Store,
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

  // Quick fill demo test credentials
  function fillDemoCredentials(code, pwd) {
    setEmpCode(code);
    setPassword(pwd);
    setErrorMsg('');
    setSuccessMsg('');
    setMode('login');
  }

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
        // Compute role category if not present
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
      <div className="login-gateway-card">
        {/* Brand Header */}
        <div className="login-gateway-header">
          <div className="login-logo-wrapper">
            <img src="/rewardly-logo.png" alt="Rewardly" className="login-logo-img" />
          </div>
          <h1 className="login-title">Kaveri Silks &amp; Textiles</h1>
          <p className="login-subtitle">
            Rewardly AI Employee Performance &amp; Retail Showroom Management
          </p>

          <div className="login-role-badge-row">
            <span className="role-pill admin">👑 Floor Manager / Admin</span>
            <span className="role-pill cashier">💳 Cashier POS</span>
            <span className="role-pill staff">🛍️ Staff Portal</span>
          </div>
        </div>

        {/* Quick 1-Click Role Testing Bar */}
        <div className="demo-credentials-bar">
          <div className="demo-bar-title">
            <Sparkles size={13} color="#f59e0b" />
            <span>Click any role to test instantly:</span>
          </div>
          <div className="demo-btn-group">
            <button
              type="button"
              className="demo-pill-btn admin"
              onClick={() => fillDemoCredentials('ADMIN01', 'Admin@123')}
              title="Test Floor Manager / Admin Interface"
            >
              <strong>👑 Admin</strong>
              <code>ADMIN01</code>
            </button>

            <button
              type="button"
              className="demo-pill-btn cashier"
              onClick={() => fillDemoCredentials('CASH01', 'Cashier@123')}
              title="Test Showroom POS & Billing Interface"
            >
              <strong>💳 Cashier</strong>
              <code>CASH01</code>
            </button>

            <button
              type="button"
              className="demo-pill-btn staff"
              onClick={() => fillDemoCredentials('STAFF01', 'Staff@123')}
              title="Test Sales Staff Performance & QR Portal"
            >
              <strong>🛍️ Staff</strong>
              <code>STAFF01</code>
            </button>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="login-mode-tabs">
          <button
            type="button"
            className={`login-mode-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            Showroom Sign In
          </button>
          <button
            type="button"
            className={`login-mode-tab ${mode === 'reset' ? 'active' : ''}`}
            onClick={() => {
              setMode('reset');
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            Forgot / Reset Password
          </button>
        </div>

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="error-banner" style={{ margin: '0 24px 14px' }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            className="card"
            style={{
              margin: '0 24px 14px',
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
          <form className="login-gateway-form" onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="field-label" htmlFor="gateway-emp-id">
                Employee ID (Username)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="gateway-emp-id"
                  type="text"
                  className="input"
                  value={empCode}
                  onChange={(e) => setEmpCode(e.target.value)}
                  placeholder="e.g. ADMIN01, CASH01, or STAFF01"
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
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                Enter your Employee ID to automatically launch your role workspace.
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 22 }}>
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
                  placeholder="Enter password"
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
              {loading ? 'Authenticating...' : 'Sign In & Launch Workspace'}
            </button>
          </form>
        ) : (
          /* Password Reset Mode */
          <form className="login-gateway-form" onSubmit={handleResetPassword}>
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
                placeholder="e.g. RW002, ADMIN01"
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
                placeholder="e.g. admin@kaverisilks.in or phone digits"
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

            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                }}
                style={{ fontSize: 12.5 }}
              >
                ← Back to Showroom Sign In
              </button>
            </div>
          </form>
        )}

        {/* Test Credentials Table Guide */}
        <div className="login-credentials-guide">
          <div className="credentials-guide-title">
            <Shield size={14} color="#6d28d9" />
            <span>Authorized Testing Credentials by Role</span>
          </div>
          <table className="credentials-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Employee ID</th>
                <th>Password</th>
                <th>Assigned Interface</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong style={{ color: '#6d28d9' }}>👑 Floor Manager / Admin</strong></td>
                <td><code>ADMIN01</code> <span className="alt-code">(or RW012)</span></td>
                <td><code>Admin@123</code></td>
                <td>Admin Dashboard, AI, Settings</td>
              </tr>
              <tr>
                <td><strong style={{ color: '#059669' }}>💳 Cashier</strong></td>
                <td><code>CASH01</code> <span className="alt-code">(or RW028)</span></td>
                <td><code>Cashier@123</code></td>
                <td>Showroom POS &amp; Billing Counter</td>
              </tr>
              <tr>
                <td><strong style={{ color: '#2563eb' }}>🛍️ Staff (Sales)</strong></td>
                <td><code>STAFF01</code> <span className="alt-code">(or RW002)</span></td>
                <td><code>Staff@123</code></td>
                <td>Staff Score, Reviews &amp; QR Standee</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
            💡 All 30 showroom employees (<code>RW001</code> to <code>RW030</code>) also accept their uppercase code as default password.
          </div>
        </div>
      </div>
    </div>
  );
}
