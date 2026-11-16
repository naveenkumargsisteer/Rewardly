import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from './api/client';
import TopHeader from './components/TopHeader';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import EmployeePortalPage from './pages/EmployeePortalPage';
import MobileFeedbackPage from './pages/MobileFeedbackPage';
import EmployeesModal from './components/EmployeesModal';
import GiveRecognitionModal from './components/GiveRecognitionModal';
import EmployeeLoginModal from './components/EmployeeLoginModal';

export default function App() {
  const feedbackMatch = window.location.pathname.match(/^\/feedback\/([^/]+)/i);
  const feedbackEmpRef = feedbackMatch ? decodeURIComponent(feedbackMatch[1]) : null;
  if (feedbackEmpRef) {
    return <MobileFeedbackPage empRef={feedbackEmpRef} />;
  }

  const initialPage = window.location.pathname.includes('settings')
    ? 'settings'
    : window.location.pathname.includes('portal')
      ? 'employee-portal'
      : 'dashboard';

  const [activePage, setActivePage] = useState(initialPage);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTab, setAiTab] = useState('chat');

  // Employee Login & Portal Session State
  const [loggedInEmployee, setLoggedInEmployee] = useState(() => {
    try {
      const saved = localStorage.getItem('rewardly_employee_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [employeeLoginModalOpen, setEmployeeLoginModalOpen] = useState(false);

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
    }, 3200);
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
  }, [showToast]);

  function handleNavigate(page) {
    setActivePage(page);
    const nextUrl =
      page === 'settings' ? '/settings' : page === 'employee-portal' ? '/portal' : '/';
    window.history.pushState({}, '', nextUrl);
  }

  function handleEmployeeLoginSuccess(employee, isDefaultPassword) {
    setLoggedInEmployee(employee);
    try {
      localStorage.setItem('rewardly_employee_user', JSON.stringify(employee));
    } catch {
      // localStorage may fail in private mode
    }
    handleNavigate('employee-portal');
    showToast(`Welcome, ${employee.full_name}! Signed in as ${employee.emp_code}.`);
    if (isDefaultPassword) {
      showToast('Tip: Consider changing your default password in the portal.');
    }
  }

  function handleEmployeeLogout() {
    setLoggedInEmployee(null);
    try {
      localStorage.removeItem('rewardly_employee_user');
    } catch {}
    handleNavigate('dashboard');
    showToast('Logged out of Employee Portal.');
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

  const pendingRewards = (dashboard?.rewards || []).filter((r) => r.status === 'Pending');

  return (
    <div className="app-shell">
      <TopHeader
        activePage={activePage}
        onNavigate={handleNavigate}
        shop={dashboard?.meta?.shop || meta?.shop}
        employeeCount={meta?.counts?.employees}
        pendingRewards={pendingRewards}
        loggedInEmployee={loggedInEmployee}
        onOpenEmployeeLogin={() => setEmployeeLoginModalOpen(true)}
        onEmployeeLogout={handleEmployeeLogout}
        onOpenRecognize={() => {
          setRecognizeEmpId(null);
          setRecognizeModalOpen(true);
        }}
        onSelectInsightsTab={() => {
          setAiTab('insights');
          setAiOpen(true);
        }}
      />

      <main className="page-container">
        {apiError && (
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

        {activePage === 'dashboard' ? (
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
        ) : activePage === 'settings' ? (
          <SettingsPage
            onBack={() => handleNavigate('dashboard')}
            onSettingsSaved={() => loadMetaAndDash(startDate, endDate, department)}
            showToast={showToast}
          />
        ) : (
          <EmployeePortalPage
            employee={loggedInEmployee}
            onLogout={handleEmployeeLogout}
            onSwitchToManager={() => handleNavigate('dashboard')}
            showToast={showToast}
          />
        )}
      </main>

      <EmployeeLoginModal
        isOpen={employeeLoginModalOpen}
        onClose={() => setEmployeeLoginModalOpen(false)}
        onLoginSuccess={handleEmployeeLoginSuccess}
      />

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

      {toastMsg && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} color="#10b981" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
