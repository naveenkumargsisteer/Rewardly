import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from './api/client';
import TopHeader from './components/TopHeader';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import MobileFeedbackPage from './pages/MobileFeedbackPage';
import EmployeesModal from './components/EmployeesModal';
import GiveRecognitionModal from './components/GiveRecognitionModal';

export default function App() {
  const feedbackMatch = window.location.pathname.match(/^\/feedback\/([^/]+)/i);
  const feedbackEmpRef = feedbackMatch ? decodeURIComponent(feedbackMatch[1]) : null;
  if (feedbackEmpRef) {
    return <MobileFeedbackPage empRef={feedbackEmpRef} />;
  }

  const initialPage = window.location.pathname.includes('settings') ? 'settings' : 'dashboard';
  const [activePage, setActivePage] = useState(initialPage);
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
    const nextUrl = page === 'settings' ? '/settings' : '/';
    window.history.pushState({}, '', nextUrl);
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
          ) : (
            <SettingsPage
              onBack={() => handleNavigate('dashboard')}
              onSettingsSaved={() => loadMetaAndDash(startDate, endDate, department)}
              showToast={showToast}
            />
          )}
      </main>

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
