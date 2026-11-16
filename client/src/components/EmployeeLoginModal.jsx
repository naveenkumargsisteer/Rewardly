import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  RotateCcw,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { api } from '../api/client';

export default function EmployeeLoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'reset'
  const [empCode, setEmpCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Reset fields
  const [resetVerification, setResetVerification] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  async function handleLogin(e) {
    e.preventDefault();
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
        onLoginSuccess(res.employee, res.isDefaultPassword);
        onClose();
      } else {
        setErrorMsg(res.error || 'Invalid credentials.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Login failed.');
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
      setErrorMsg('New password must be at least 4 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
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
        setSuccessMsg('Password reset successful! You can now sign in with your new password.');
        setPassword(newPassword);
        setMode('login');
      } else {
        setErrorMsg(res.error || 'Password reset failed.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Reset failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="emp-login-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="emp-login-head">
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
            style={{ position: 'absolute', top: 16, right: 16 }}
          >
            <X size={18} />
          </button>
          <img src="/rewardly-logo.png" alt="Rewardly logo" className="brand-logo-img" />
          <h2 className="emp-login-title">Employee Portal</h2>
          <p className="emp-login-subtitle">
            {mode === 'login'
              ? 'Sign in using your Employee ID as your username'
              : 'Verify identity and reset your password'}
          </p>
        </div>

        <div className="emp-login-body">
          {/* Mode Switcher */}
          <div className="emp-mode-tabs">
            <button
              type="button"
              className={`emp-mode-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`emp-mode-tab ${mode === 'reset' ? 'active' : ''}`}
              onClick={() => {
                setMode('reset');
                setErrorMsg('');
                setSuccessMsg('');
              }}
            >
              Forgot / Reset Password
            </button>
          </div>

          {errorMsg && (
            <div className="error-banner" style={{ marginBottom: 14 }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              className="card"
              style={{
                marginBottom: 14,
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

          {/* Login Mode */}
          {mode === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="field-label" htmlFor="emp-login-id">
                  Employee ID (Username)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="emp-login-id"
                    type="text"
                    className="input"
                    value={empCode}
                    onChange={(e) => setEmpCode(e.target.value)}
                    placeholder="e.g. RW002 or KVR-031"
                    autoFocus
                    required
                    style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}
                  />
                  <User
                    size={16}
                    color="#94a3b8"
                    style={{ position: 'absolute', right: 12, top: 12, pointerEvents: 'none' }}
                  />
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  Your unique Employee Code is your only login username.
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="field-label" htmlFor="emp-login-pwd">
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
                <div className="input-with-toggle">
                  <input
                    id="emp-login-pwd"
                    type={showPassword ? 'text' : 'password'}
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
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
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  💡 First time? Default password is your Employee ID (e.g. <code>RW002</code>).
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', fontSize: 14 }}
              >
                <LogIn size={16} />
                {loading ? 'Authenticating...' : 'Sign In to Employee Portal'}
              </button>
            </form>
          ) : (
            /* Reset Mode */
            <form onSubmit={handleResetPassword}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="field-label" htmlFor="emp-reset-id">
                  Employee ID (Username)
                </label>
                <input
                  id="emp-reset-id"
                  type="text"
                  className="input"
                  value={empCode}
                  onChange={(e) => setEmpCode(e.target.value)}
                  placeholder="e.g. RW002"
                  required
                  style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="field-label" htmlFor="emp-reset-verify">
                  Registered Email or Phone Number
                </label>
                <input
                  id="emp-reset-verify"
                  type="text"
                  className="input"
                  value={resetVerification}
                  onChange={(e) => setResetVerification(e.target.value)}
                  placeholder="Enter email or 10-digit phone number"
                  required
                />
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  Used to verify your identity against the showroom roster.
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="field-label" htmlFor="emp-new-pwd">
                  New Password
                </label>
                <div className="input-with-toggle">
                  <input
                    id="emp-new-pwd"
                    type={showNewPassword ? 'text' : 'password'}
                    className="input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 4 characters"
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
                <label className="field-label" htmlFor="emp-confirm-pwd">
                  Confirm New Password
                </label>
                <input
                  id="emp-confirm-pwd"
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
                style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', fontSize: 14 }}
              >
                <RotateCcw size={16} />
                {loading ? 'Verifying & Resetting...' : 'Reset Password & Proceed'}
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
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 11.5,
              color: 'var(--text-muted)',
            }}
          >
            <ShieldCheck size={14} color="#10b981" />
            <span>Encrypted credentials &amp; optimized cloud profile sync</span>
          </div>
        </div>
      </div>
    </div>
  );
}

