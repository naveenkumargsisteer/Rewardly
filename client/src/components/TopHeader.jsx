import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  Bell,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  Store,
  User,
  UserCheck,
} from 'lucide-react';
import EmployeeAvatar from './EmployeeAvatar';

export default function TopHeader({
  activePage,
  onNavigate,
  shop,
  employeeCount,
  pendingRewards,
  onOpenRecognize,
  onSelectInsightsTab,
  currentUser,
  onLogout,
}) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifs(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const userName = currentUser?.full_name || shop?.owner_name || 'Rajeshwari Deshpande';
  const userRole = currentUser?.role || 'Floor Manager / Admin';
  const roleCategory = currentUser?.role_category || 'admin';

  function goToPage(page) {
    setShowProfileMenu(false);
    setShowNotifs(false);
    onNavigate(page);
  }

  const headerTitle =
    activePage === 'settings'
      ? 'Rewardly Settings'
      : activePage === 'billing'
        ? 'Showroom POS & Billing'
        : activePage === 'employee-portal'
          ? `Staff Portal — ${currentUser?.full_name || 'Staff'}`
          : 'Rewardly Performance & Loyalty';

  return (
    <header className="top-header">
      <div className="brand-group">
        <button
          type="button"
          className="brand-logo"
          onClick={() => goToPage(roleCategory === 'cashier' ? 'billing' : roleCategory === 'staff' ? 'employee-portal' : 'dashboard')}
          title="Rewardly"
          aria-label="Go to Home"
        >
          <img src="/rewardly-logo.png" alt="Rewardly logo" className="brand-logo-img" />
        </button>
        <div>
          <h1 className="brand-title">
            {headerTitle}
            <span className="brand-badge">{shop?.name || 'Kaveri Silks & Textiles'}</span>
            {activePage === 'billing' && (
              <span
                style={{
                  marginLeft: 8,
                  background: '#ede9fe',
                  color: '#6d28d9',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                POS-KVR-01 • Counter #1
              </span>
            )}
          </h1>
          <p className="brand-subtitle">
            {shop?.tagline || 'AI-Powered Employee Performance, Loyalty & Recognition'}
          </p>
        </div>
      </div>

      <div className="header-actions">
        {/* Admin Navigation Controls */}
        {roleCategory === 'admin' && (
          <>
            <button
              type="button"
              className={`btn btn-sm ${activePage === 'billing' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => goToPage('billing')}
              title="Open Showroom POS & Billing Interface"
            >
              <CreditCard size={14} />
              <span>POS Billing</span>
            </button>

            {activePage !== 'employee-portal' && (
              <button type="button" className="btn btn-primary btn-sm" onClick={onOpenRecognize}>
                <Award size={14} />
                Give Recognition
              </button>
            )}
          </>
        )}

        {/* Staff Quick Action: Attach & Scan Bill */}
        {(activePage === 'employee-portal' || roleCategory === 'staff') && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => window.dispatchEvent(new CustomEvent('rewardly:open_attach_bill'))}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Attach & Scan showroom bill to credit sales"
          >
            <Receipt size={14} />
            <span>Attach Bill</span>
          </button>
        )}

        {/* Notifications (Only for Admin / Floor Manager) */}
        {roleCategory === 'admin' && (
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="icon-btn"
              aria-label="Notifications"
              onClick={() => {
                setShowNotifs((v) => !v);
                setShowProfileMenu(false);
              }}
            >
              <Bell size={17} />
              {pendingRewards.length > 0 && (
                <span className="notif-dot">{pendingRewards.length}</span>
              )}
            </button>

            {showNotifs && (
              <div
                className="card"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 46,
                  width: 320,
                  padding: 14,
                  zIndex: 60,
                  boxShadow: '0 18px 40px rgba(15,23,42,0.16)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <strong style={{ fontSize: 13 }}>Pending Reward Approvals</strong>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setShowNotifs(false);
                      onNavigate('dashboard');
                      onSelectInsightsTab?.();
                    }}
                  >
                    Review Queue
                  </button>
                </div>
                {pendingRewards.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                    All AI reward recommendations have been reviewed.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pendingRewards.slice(0, 4).map((r) => (
                      <div
                        key={r.id}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 10,
                          background: '#f8f9fd',
                          border: '1px solid var(--border)',
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{r.employee_name}</div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          {r.reward_title} • ₹{Number(r.bonus_amount_inr).toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* User Profile Dropdown Chip */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className={`owner-chip ${showProfileMenu ? 'open' : ''}`}
            onClick={() => {
              setShowProfileMenu((v) => !v);
              setShowNotifs(false);
            }}
            aria-expanded={showProfileMenu}
            aria-haspopup="menu"
          >
            <EmployeeAvatar employee={currentUser} size={30} />
            <div style={{ textAlign: 'left' }}>
              <div className="owner-name">{userName}</div>
              <div className="owner-role" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {roleCategory === 'admin' && '👑 Floor Manager / Admin'}
                {roleCategory === 'cashier' && '💳 Cashier'}
                {roleCategory === 'staff' && '🛍️ Sales Staff'}
              </div>
            </div>
            <ChevronDown
              size={14}
              color="#646b82"
              style={{
                marginLeft: 2,
                transition: 'transform 0.16s ease',
                transform: showProfileMenu ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          {showProfileMenu && (
            <div className="card profile-dropdown" role="menu">
              <div className="profile-dropdown-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <EmployeeAvatar employee={currentUser} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {userName}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      ID: {currentUser?.emp_code || 'ADMIN01'} • {userRole}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11.5, color: 'var(--text-muted)' }}>
                  <img src="/rewardly-logo.png" alt="Rewardly" style={{ width: 15, height: 15, objectFit: 'contain' }} />
                  <span>Rewardly • {employeeCount ?? 30} Staff • Flagship Showroom</span>
                </div>
              </div>

              <div className="profile-dropdown-items">
                {roleCategory === 'admin' ? (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className={`profile-menu-item ${activePage === 'dashboard' ? 'active' : ''}`}
                      onClick={() => goToPage('dashboard')}
                    >
                      <LayoutDashboard size={16} />
                      <div>
                        <div className="profile-item-title">Dashboard</div>
                        <div className="profile-item-sub">KPIs, AI Assistant &amp; Employee Roster</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className={`profile-menu-item ${activePage === 'settings' ? 'active' : ''}`}
                      onClick={() => goToPage('settings')}
                    >
                      <Settings size={16} />
                      <div>
                        <div className="profile-item-title">Settings</div>
                        <div className="profile-item-sub">Weights, Staff &amp; Departments</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className={`profile-menu-item ${activePage === 'billing' ? 'active' : ''}`}
                      onClick={() => goToPage('billing')}
                    >
                      <CreditCard size={16} />
                      <div>
                        <div className="profile-item-title">Showroom POS &amp; Billing</div>
                        <div className="profile-item-sub">Terminal POS-KVR-01 Counter</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className={`profile-menu-item ${activePage === 'employee-portal' ? 'active' : ''}`}
                      onClick={() => goToPage('employee-portal')}
                    >
                      <UserCheck size={16} />
                      <div>
                        <div className="profile-item-title">Staff Portal View</div>
                        <div className="profile-item-sub">Preview Employee Score &amp; KPIs</div>
                      </div>
                    </button>
                  </>
                ) : roleCategory === 'cashier' ? (
                  <button
                    type="button"
                    role="menuitem"
                    className={`profile-menu-item ${activePage === 'billing' ? 'active' : ''}`}
                    onClick={() => goToPage('billing')}
                  >
                    <CreditCard size={16} />
                    <div>
                      <div className="profile-item-title">POS Billing Counter</div>
                      <div className="profile-item-sub">Terminal POS-KVR-01</div>
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className={`profile-menu-item ${activePage === 'employee-portal' ? 'active' : ''}`}
                    onClick={() => goToPage('employee-portal')}
                  >
                    <UserCheck size={16} />
                    <div>
                      <div className="profile-item-title">My Staff Portal</div>
                      <div className="profile-item-sub">Performance, Scores &amp; Reviews</div>
                    </div>
                  </button>
                )}

                <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
                  <button
                    type="button"
                    role="menuitem"
                    className="profile-menu-item"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onLogout();
                    }}
                    style={{ color: '#dc2626' }}
                  >
                    <LogOut size={16} />
                    <div>
                      <div className="profile-item-title" style={{ color: '#dc2626' }}>Sign Out</div>
                      <div className="profile-item-sub">Return to Showroom Login</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
