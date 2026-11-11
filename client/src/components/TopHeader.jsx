import React, { useEffect, useRef, useState } from 'react';
import {
  Award, Bell, ChevronDown, Settings, Sparkles, Store,
} from 'lucide-react';

function getOwnerInitials(name) {
  const parts = String(name || 'Rajeshwari Deshpande')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'RD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function TopHeader({
  activePage,
  onNavigate,
  shop,
  employeeCount,
  pendingRewards,
  onOpenRecognize,
  onSelectInsightsTab,
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

  const ownerName = shop?.owner_name || 'Rajeshwari Deshpande';
  const ownerInitials = getOwnerInitials(ownerName);

  function goToPage(page) {
    setShowProfileMenu(false);
    setShowNotifs(false);
    onNavigate(page);
  }

  return (
    <header className="top-header">
      <div className="brand-group">
        <button
          type="button"
          className="brand-logo"
          onClick={() => goToPage('dashboard')}
          title="Rewardly Dashboard"
          aria-label="Go to Dashboard"
          style={{ border: 'none', cursor: 'pointer', flexShrink: 0 }}
        >
          <Sparkles size={19} />
        </button>
        <div>
          <h1 className="brand-title">
            {activePage === 'settings' ? 'Settings' : 'Performance & Loyalty Dashboard'}
            <span className="brand-badge">{shop?.name || 'Kaveri Silks & Textiles'}</span>
          </h1>
          <p className="brand-subtitle">
            {shop?.tagline || 'AI-Powered Employee Performance, Loyalty & Recognition'}
          </p>
        </div>
      </div>

      <div className="header-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onOpenRecognize}>
          <Award size={14} />
          Give Recognition
        </button>

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
                    onSelectInsightsTab();
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
            <span className="avatar" style={{ background: '#6d28d9' }}>{ownerInitials}</span>
            <div style={{ textAlign: 'left' }}>
              <div className="owner-name">{ownerName}</div>
              <div className="owner-role">Showroom Owner</div>
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
                  <span className="avatar" style={{ background: '#6d28d9', width: 36, height: 36 }}>
                    {ownerInitials}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ownerName}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      Showroom Owner
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11.5, color: 'var(--text-muted)' }}>
                  <Store size={13} color="var(--primary)" />
                  <span>{employeeCount ?? 30} Staff • 4-Month Window</span>
                </div>
              </div>

              <div className="profile-dropdown-items">
                <button
                  type="button"
                  role="menuitem"
                  className={`profile-menu-item ${activePage === 'settings' ? 'active' : ''}`}
                  onClick={() => goToPage('settings')}
                >
                  <Settings size={16} />
                  <div>
                    <div className="profile-item-title">Settings</div>
                    <div className="profile-item-sub">Weights, Showroom, Staff &amp; Depts</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
