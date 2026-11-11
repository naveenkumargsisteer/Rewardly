import React, { useEffect, useState } from 'react';
import { Calendar, Filter, Users, LayoutGrid, Sparkles } from 'lucide-react';
import KpiCards from '../components/KpiCards';
import TrendChartCard from '../components/TrendChartCard';
import DeptBarChartCard from '../components/DeptBarChartCard';
import RecognitionDonutCard from '../components/RecognitionDonutCard';
import TopEmployeesCard from '../components/TopEmployeesCard';
import CustomDashboardWorkspace, { DEFAULT_CUSTOM_WIDGETS } from '../components/CustomDashboardWorkspace';
import AiAssistantPanel from '../components/AiAssistantPanel';
import RewardlyLoader from '../components/RewardlyLoader';

const STORAGE_KEY = 'rewardly_custom_widgets_v1';

function shiftDate(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage({
  dashboard,
  loading,
  departments,
  dateBounds,
  startDate,
  endDate,
  department,
  onChangeRange,
  onChangeDepartment,
  aiOpen,
  onToggleAiOpen,
  aiTab,
  onChangeAiTab,
  onViewAllEmployees,
  onSelectEmployee,
  onRewardAction,
  showToast,
}) {
  const [dashboardTab, setDashboardTab] = useState('static'); // 'static' | 'custom'
  const [customWidgets, setCustomWidgets] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return DEFAULT_CUSTOM_WIDGETS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customWidgets));
    } catch {}
  }, [customWidgets]);

  const minDate = dateBounds?.minDate || '2026-07-12';
  const maxDate = dateBounds?.maxDate || '2026-11-11';

  function applyPreset(preset) {
    if (preset === '4m') {
      onChangeRange(minDate, maxDate);
    } else if (preset === '60d') {
      onChangeRange(shiftDate(maxDate, -59), maxDate);
    } else if (preset === '30d') {
      onChangeRange(shiftDate(maxDate, -29), maxDate);
    } else if (preset === 'festive') {
      onChangeRange('2026-10-01', maxDate);
    }
  }

  function handlePinChartToCustom(chartSpec) {
    const newWidget = {
      id: `pin-${Date.now()}`,
      kind: 'ai',
      title: chartSpec.title || 'Custom AI Chart',
      chartType: chartSpec.type || 'bar',
      chartSpec,
      span: 1,
    };
    setCustomWidgets((prev) => [newWidget, ...prev]);
    setDashboardTab('custom');
    showToast(`Added "${newWidget.title}" to Custom Dashboard!`);
  }

  return (
    <div className="dashboard-full">
      <div className="overview-shell">
        <div className="card toolbar-card">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
            <div className="section-title-wrap">
              <div className="section-icon">
                <Users size={18} />
              </div>
              <div>
                <h2 className="section-title">Employee Overview</h2>
                <p className="section-sub">
                  {dashboard?.meta?.shop?.name || 'Kaveri Silks & Textiles'} •{' '}
                  {dashboard?.meta?.activeRange?.days || 123} days ({startDate} to {endDate})
                </p>
              </div>
            </div>

            {/* Static & Custom Dashboard Tabs */}
            <div className="nav-pills mode-tabs" role="tablist" aria-label="Dashboard mode">
              <button
                type="button"
                role="tab"
                aria-selected={dashboardTab === 'static'}
                className={`nav-pill ${dashboardTab === 'static' ? 'active' : ''}`}
                onClick={() => setDashboardTab('static')}
              >
                <LayoutGrid size={14} />
                Static
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={dashboardTab === 'custom'}
                className={`nav-pill ${dashboardTab === 'custom' ? 'active' : ''}`}
                onClick={() => setDashboardTab('custom')}
              >
                <Sparkles size={14} />
                Custom
                <span className="mode-count-pill">{customWidgets.length}</span>
              </button>
            </div>
          </div>

          <div className="filter-controls">
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Calendar size={14} color="var(--text-muted)" />
              <select
                className="select"
                aria-label="Date preset"
                value={
                  startDate === minDate && endDate === maxDate
                    ? '4m'
                    : startDate === '2026-10-01' && endDate === maxDate
                      ? 'festive'
                      : startDate === shiftDate(maxDate, -59) && endDate === maxDate
                        ? '60d'
                        : startDate === shiftDate(maxDate, -29) && endDate === maxDate
                          ? '30d'
                          : 'custom'
                }
                onChange={(e) => applyPreset(e.target.value)}
              >
                <option value="4m">Last 4 Months (All)</option>
                <option value="60d">Last 60 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="festive">Festive Season (Oct–Nov)</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            <input
              type="date"
              className="input"
              aria-label="Start date"
              min={minDate}
              max={endDate}
              value={startDate}
              onChange={(e) => onChangeRange(e.target.value, endDate)}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="input"
              aria-label="End date"
              min={startDate}
              max={maxDate}
              value={endDate}
              onChange={(e) => onChangeRange(startDate, e.target.value)}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Filter size={14} color="var(--text-muted)" />
              <select
                className="select"
                aria-label="Department filter"
                value={department}
                onChange={(e) => onChangeDepartment(e.target.value)}
              >
                <option value="all">All Departments (6)</option>
                {(departments || []).map((d) => (
                  <option key={d.id} value={d.code}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading && dashboard && (
          <RewardlyLoader variant="pill" message="Updating showroom metrics..." />
        )}

        {loading && !dashboard ? (
          <RewardlyLoader message="Loading Kaveri Silks & Textiles dashboard metrics..." />
        ) : (
          <>
            <KpiCards
              kpis={dashboard?.kpis}
              comparisonLabel={dashboard?.meta?.comparisonLabel || 'vs prior period'}
            />

            {dashboardTab === 'static' ? (
              <>
                <div className="charts-grid-2">
                  <TrendChartCard monthlyTrend={dashboard?.monthlyTrend} />
                  <DeptBarChartCard departments={dashboard?.departmentBreakdown} />
                </div>

                <div className="charts-grid-2">
                  <RecognitionDonutCard recognitionByType={dashboard?.recognitionByType} />
                  <TopEmployeesCard
                    employees={dashboard?.employeesRanked}
                    onViewAll={onViewAllEmployees}
                    onSelectEmployee={onSelectEmployee}
                  />
                </div>
              </>
            ) : (
              <CustomDashboardWorkspace
                dashboard={dashboard}
                widgets={customWidgets}
                onChangeWidgets={setCustomWidgets}
                startDate={startDate}
                endDate={endDate}
                department={department}
                showToast={showToast}
              />
            )}
          </>
        )}
      </div>

      {/* Bottom-Right Collapsible/Expandable AI Chatbot */}
      <AiAssistantPanel
        isOpen={aiOpen}
        onToggleOpen={onToggleAiOpen}
        activeTab={aiTab}
        onTabChange={onChangeAiTab}
        dashboardMode={dashboardTab}
        startDate={startDate}
        endDate={endDate}
        department={department}
        aiInsights={dashboard?.aiInsights}
        rewards={dashboard?.rewards}
        onRewardAction={onRewardAction}
        onAddChartToCustom={handlePinChartToCustom}
      />
    </div>
  );
}
