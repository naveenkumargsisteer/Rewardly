import React from 'react';
import {
  LayoutDashboard,
  Settings,
  Sparkles,
  Store,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export default function SidebarMenu({
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  shop,
  employeeCount,
}) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Static & Custom AI Views' },
    { id: 'settings', label: 'Settings', icon: Settings, desc: 'Exposed API & Weights' },
  ];

  function handleSelect(id) {
    onNavigate(id);
    if (onCloseMobile) onCloseMobile();
  }

  return (
    <>
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={onCloseMobile} aria-hidden="true" />
      )}
      <aside className={`sidebar-menu ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo" aria-hidden="true">
            <Sparkles size={19} />
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-brand-name">Rewardly</div>
              <div className="sidebar-brand-sub">{shop?.name || 'Kaveri Silks'}</div>
            </div>
          )}
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <div className="sidebar-section-label">{!collapsed ? 'MENU' : '•••'}</div>

        <nav className="sidebar-nav" aria-label="Main menu">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleSelect(item.id)}
                title={item.label}
              >
                <Icon size={18} />
                {!collapsed && (
                  <div className="sidebar-item-text">
                    <span className="sidebar-item-label">{item.label}</span>
                    <span className="sidebar-item-desc">{item.desc}</span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="sidebar-footer-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 12 }}>
              <Store size={14} color="var(--primary)" />
              <span>Showroom Live</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
              {employeeCount || 30} Indian Staff • 4-Month Window • Supabase Ready
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

