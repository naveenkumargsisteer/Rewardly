import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { api } from './api/client';
import SidebarMenu from './components/SidebarMenu';
import TopHeader from './components/TopHeader';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import EmployeesModal from './components/EmployeesModal';
import GiveRecognitionModal from './components/GiveRecognitionModal';

export default function App() {
  const initialPage = window.location.pathname.includes('settings') ? 'settings' : 'dashboard';
  const [activePage, setActivePage] = useState(initialPage);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTab, setAiTab] = useState('chat');

  const [meta, setMeta] = useState(null);
  const [startDate, setStartDate] = useState('2026-07-12');
  const [endDate, setEndDate] = useState('2026-11-11');
  const [department, setDepartment] = useState('all');

  const [dashboard, setDashboard] = useState(null);
  const [loadingDash, setLoadingDash] = useState(true);

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
    try {
      const [metaData, dashData] = await Promise.all([
        api.getMeta(),
        api.getDashboard({ startDate: sDate, endDate: eDate, department: dept }),
      ]);
      setMeta(metaData);
      setDashboard(dashData);
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoadingDash(false);
    }
  }, [showToast]);

  useEffect(() => {
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
      .catch((err) => showToast(err.message))
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
    <div className="app-layout">
      <SidebarMenu
        activePage={activePage}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        shop={dashboard?.meta?.shop || meta?.shop}
        employeeCount={meta?.counts?.employees}
      />

      <div className="app-main-col">
        <TopHeader
          activePage={activePage}
          onNavigate={handleNavigate}
          onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)}
          shop={dashboard?.meta?.shop || meta?.shop}
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
              departments={meta?.departments || []}
              onSettingsSaved={() => loadMetaAndDash(startDate, endDate, department)}
              showToast={showToast}
            />
          )}
        </main>
      </div>

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
