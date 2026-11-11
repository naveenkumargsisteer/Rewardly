import React, { useState } from 'react';
import { Award, Bell, Menu } from 'lucide-react';

export default function TopHeader({
  activePage,
  onNavigate,
  onToggleMobileMenu,
  shop,
  pendingRewards,
  onOpenRecognize,
  onSelectInsightsTab,
}) {
  const [showNotifs, setShowNotifs] = useState(false);

  return (
    <header className="top-header">
      <div className="brand-group">
        <button
          type="button"
          className="icon-btn mobile-menu-btn"
          onClick={onToggleMobileMenu}
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="brand-title">
            {activePage === 'settings' ? 'Settings & API Exposure' : 'Performance & Loyalty Dashboard'}
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

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="icon-btn"
            aria-label="Notifications"
            onClick={() => setShowNotifs((v) => !v)}
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

        <div className="owner-chip">
          <span className="avatar" style={{ background: '#6d28d9' }}>RD</span>
          <div>
            <div className="owner-name">{shop?.owner_name || 'Rajeshwari Deshpande'}</div>
            <div className="owner-role">Showroom Owner</div>
          </div>
        </div>
      </div>
    </header>
  );
}
