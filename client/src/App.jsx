import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { api, getRoleCategory } from './api/client';
import TopHeader from './components/TopHeader';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import EmployeePortalPage from './pages/EmployeePortalPage';
import BillingPage from './pages/BillingPage';
import MobileFeedbackPage from './pages/MobileFeedbackPage';
import LoginPage from './pages/LoginPage';
import EmployeesModal from './components/EmployeesModal';
import GiveRecognitionModal from './components/GiveRecognitionModal';

export default function App() {
  // Public customer rating QR destination (/feedback/:empRef) - NO LOGIN REQUIRED
  const feedbackMatch = window.location.pathname.match(/^\/feedback\/([^/]+)/i);
  const feedbackEmpRef = feedbackMatch ? decodeURIComponent(feedbackMatch[1]) : null;
  if (feedbackEmpRef) {
    return <MobileFeedbackPage empRef={feedbackEmpRef} />;
  }

  // Unified Role-Based User Authentication Session
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('rewardly_auth_user') || localStorage.getItem('rewardly_employee_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      const roleCategory = parsed.role_category || getRoleCategory(parsed.role, parsed.emp_code);
      return { ...parsed, role_category: roleCategory };
    } catch {
      return null;
    }
  });

  // Active page resolution based on current role
  const [activePage, setActivePage] = useState(() => {
    if (!currentUser) return 'login';
    const cat = currentUser.role_category || getRoleCategory(currentUser.role, currentUser.emp_code);
    if (cat === 'cashier') return 'billing';
    if (cat === 'staff') return 'employee-portal';
    if (window.location.pathname.includes('settings')) return 'settings';
    if (window.location.pathname.includes('billing')) return 'billing';
    if (window.location.pathname.includes('portal')) return 'employee-portal';
    return 'dashboard';
  });

  const [aiOpen, setAiOpen] = useState(false);
  const [aiTab, setAiTab] = useState('chat');

  const [meta, setMeta] = useState(null);
  const [startDate, setStartDate] = useState('2026-07-12');
  const [endDate, setEndDate] = useState('2026-11-11');
  const [department, setDepartment] = useState('all');

  const [dashboard, setDashboard] = useState(null);
  const [loadingDash, setLoadingDash] = useState(true);
  const [apiError, setApiError] = useState('');

  const [employeesModalOpen, setEmployeesModalOpen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [recognizeModalOpen, setRecognizeModalOpen] = useState(false);
  const [recognizeEmpId, setRecognizeEmpId] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? '' : prev));
    }, 3400);
  }, []);

  const loadMetaAndDash = useCallback(async (sDate, eDate, dept) => {
    setLoadingDash(true);
    setApiError('');
    try {
      const metaData = await api.getMeta();
      let activeDept = dept;
      if (
        activeDept &&
        activeDept !== 'all' &&
        !(metaData.departments || []).some((d) => d.code === activeDept || d.id === activeDept)
      ) {
        activeDept = 'all';
        setDepartment('all');
      }
      const dashData = await api.getDashboard({ startDate: sDate, endDate: eDate, department: activeDept });
      setMeta(metaData);
      setDashboard(dashData);
    } catch (err) {
      setApiError(err.message || 'Failed to load data from backend API.');
      showToast(err.message);
    } finally {
      setLoadingDash(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!currentUser) return;
    setApiError('');
    api.getMeta()
      .then((m) => {
        setMeta(m);
        const s = m.dateBounds?.minDate || '2026-07-12';
        const e = m.dateBounds?.maxDate || '2026-11-11';
        setStartDate(s);
        setEndDate(e);
        return api.getDashboard({ startDate: s, endDate: e, department: 'all' });
      })
      .then((d) => setDashboard(d))
      .catch((err) => {
        setApiError(err.message || 'Failed to load data from backend API.');
        showToast(err.message);
      })
      .finally(() => setLoadingDash(false));
  }, [currentUser, showToast]);

  // Real-time live synchronization for sales and customer feedback across dashboard
  useEffect(() => {
    function handleLiveUpdate() {
      if (currentUser && (activePage === 'dashboard' || activePage === 'employees')) {
        loadMetaAndDash(startDate, endDate, department);
      }
    }
    function handleStorage(e) {
      if (
        (e.key === 'rewardly:last_sale_timestamp' || e.key === 'rewardly:last_feedback_timestamp') &&
        currentUser &&
        (activePage === 'dashboard' || activePage === 'employees')
      ) {
        loadMetaAndDash(startDate, endDate, department);
      }
    }
    window.addEventListener('rewardly:sale_created', handleLiveUpdate);
    window.addEventListener('rewardly:feedback_created', handleLiveUpdate);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('rewardly:sale_created', handleLiveUpdate);
      window.removeEventListener('rewardly:feedback_created', handleLiveUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentUser, activePage, startDate, endDate, department, loadMetaAndDash]);

  function handleNavigate(page) {
    setActivePage(page);
    const nextUrl =
      page === 'settings'
        ? '/settings'
        : page === 'billing'
          ? '/billing'
          : page === 'employee-portal'
            ? '/portal'
            : '/';
    window.history.pushState({}, '', nextUrl);
  }

  function handleLoginSuccess(user, isDefaultPassword) {
    const roleCat = user.role_category || getRoleCategory(user.role, user.emp_code);
    const enrichedUser = { ...user, role_category: roleCat };

    setCurrentUser(enrichedUser);
    try {
      localStorage.setItem('rewardly_auth_user', JSON.stringify(enrichedUser));
    } catch {}

    // Route to role-specific interface
    if (roleCat === 'cashier') {
      handleNavigate('billing');
      showToast(`Welcome, ${user.full_name}! POS Billing Terminal ready.`);
    } else if (roleCat === 'staff') {
      handleNavigate('employee-portal');
      showToast(`Welcome, ${user.full_name}! Staff Portal ready.`);
    } else {
      handleNavigate('dashboard');
      showToast(`Welcome, ${user.full_name}! Showroom Admin Dashboard loaded.`);
    }

    if (isDefaultPassword) {
      setTimeout(() => {
        showToast('Tip: Consider changing your default password.');
      }, 1500);
    }
  }

  function handleLogout() {
    setCurrentUser(null);
    try {
      localStorage.removeItem('rewardly_auth_user');
      localStorage.removeItem('rewardly_employee_user');
    } catch {}
    setActivePage('login');
    window.history.pushState({}, '', '/');
    showToast('Signed out successfully.');
  }

  function handleChangeRange(nextStart, nextEnd) {
    if (!nextStart || !nextEnd) return;
    if (nextStart > nextEnd) {
      showToast('Start date cannot be after end date.');
      return;
    }
    setStartDate(nextStart);
    setEndDate(nextEnd);
    loadMetaAndDash(nextStart, nextEnd, department);
  }

  function handleChangeDepartment(nextDept) {
    setDepartment(nextDept);
    loadMetaAndDash(startDate, endDate, nextDept);
  }

  async function handleRewardAction(rewardId, status) {
    try {
      await api.updateRewardStatus(rewardId, status);
      await loadMetaAndDash(startDate, endDate, department);
      showToast(`Reward recommendation ${status.toLowerCase()}!`);
    } catch (err) {
      showToast(err.message);
    }
  }

  // If user is not authenticated, show the secure Role-Based Login Gateway
  if (!currentUser) {
    return (
      <>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
        {toastMsg && (
          <div className="toast" role="status">
            <CheckCircle2 size={16} color="#10b981" />
            <span>{toastMsg}</span>
          </div>
        )}
      </>
    );
  }

  const roleCategory = currentUser.role_category || getRoleCategory(currentUser.role, currentUser.emp_code);
  const pendingRewards = (dashboard?.rewards || []).filter((r) => r.status === 'Pending');

  return (
    <div className="app-shell">
      {/* Top Header: Displays user identity and role controls. NO "Employee Login" button in main admin! */}
      <TopHeader
        activePage={activePage}
        onNavigate={handleNavigate}
        shop={dashboard?.meta?.shop || meta?.shop}
        employeeCount={meta?.counts?.employees}
        pendingRewards={pendingRewards}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenRecognize={() => {
          setRecognizeEmpId(null);
          setRecognizeModalOpen(true);
        }}
        onSelectInsightsTab={() => {
          setAiTab('insights');
          setAiOpen(true);
        }}
      />

      <main className="page-container" style={activePage === 'billing' ? { padding: 0, maxWidth: '100%' } : {}}>
        {apiError && activePage !== 'billing' && (
          <div
            className="card"
            role="alert"
            style={{
              marginBottom: 14,
              padding: '12px 16px',
              borderColor: '#fca5a5',
              background: '#fef2f2',
              color: '#991b1b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <AlertTriangle size={18} />
              <div>
                <strong>Data Load Error:</strong> {apiError}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadMetaAndDash(startDate, endDate, department)}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {/* Dynamic Role-Based Interface Routing */}
        {activePage === 'billing' ? (
          <BillingPage
            user={currentUser}
            onLogout={handleLogout}
            onSwitchToManager={() => handleNavigate('dashboard')}
            showToast={showToast}
          />
        ) : activePage === 'employee-portal' ? (
          <EmployeePortalPage
            employee={currentUser}
            onLogout={handleLogout}
            onSwitchToManager={() => handleNavigate('dashboard')}
            showToast={showToast}
          />
        ) : activePage === 'settings' ? (
          <SettingsPage
            onBack={() => handleNavigate('dashboard')}
            onSettingsSaved={() => loadMetaAndDash(startDate, endDate, department)}
            showToast={showToast}
          />
        ) : (
          <DashboardPage
            dashboard={dashboard}
            loading={loadingDash}
            departments={meta?.departments || []}
            dateBounds={meta?.dateBounds}
            startDate={startDate}
            endDate={endDate}
            department={department}
            onChangeRange={handleChangeRange}
            onChangeDepartment={handleChangeDepartment}
            aiOpen={aiOpen}
            onToggleAiOpen={() => setAiOpen((v) => !v)}
            aiTab={aiTab}
            onChangeAiTab={setAiTab}
            onViewAllEmployees={() => {
              setSelectedEmpId(null);
              setEmployeesModalOpen(true);
            }}
            onSelectEmployee={(empId) => {
              setSelectedEmpId(empId);
              setEmployeesModalOpen(true);
            }}
            onRewardAction={handleRewardAction}
            showToast={showToast}
          />
        )}
      </main>

      {/* Admin Modals */}
      {roleCategory === 'admin' && (
        <>
          <EmployeesModal
            isOpen={employeesModalOpen}
            initialEmployeeId={selectedEmpId}
            employees={dashboard?.employeesRanked || []}
            departments={meta?.departments || []}
            startDate={startDate}
            endDate={endDate}
            onClose={() => setEmployeesModalOpen(false)}
            onOpenRecognizeFor={(empId) => {
              setRecognizeEmpId(empId);
              setRecognizeModalOpen(true);
            }}
          />

          <GiveRecognitionModal
            isOpen={recognizeModalOpen}
            employees={dashboard?.employeesRanked || []}
            preselectedEmployeeId={recognizeEmpId}
            defaultDate={endDate}
            onClose={() => setRecognizeModalOpen(false)}
            onSuccess={() => {
              loadMetaAndDash(startDate, endDate, department);
              showToast('Recognition awarded and employee score updated!');
            }}
          />
        </>
      )}

      {toastMsg && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} color="#10b981" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
