import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  GripVertical,
  X,
  Maximize2,
  Minimize2,
  RotateCcw,
  Wand2,
} from 'lucide-react';
import CustomChartRenderer, { CHART_TYPE_OPTIONS } from './CustomChartRenderer';
import { api } from '../api/client';

export const DEFAULT_CUSTOM_WIDGETS = [
  {
    id: 'w-monthly-perf',
    kind: 'metric',
    title: 'Monthly Performance & Loyalty Trend',
    metric: 'performanceScore',
    groupBy: 'month',
    chartType: 'area',
    span: 1,
  },
  {
    id: 'w-dept-sales',
    kind: 'metric',
    title: 'Net Sales by Textile Department (₹ Lakhs)',
    metric: 'netSalesLakhs',
    groupBy: 'department',
    chartType: 'bar',
    span: 1,
  },
  {
    id: 'w-top-staff',
    kind: 'metric',
    title: 'Top 8 Employees — Composite Score %',
    metric: 'compositeScore',
    groupBy: 'topEmployees',
    chartType: 'horizontalBar',
    span: 1,
  },
  {
    id: 'w-rec-type',
    kind: 'metric',
    title: 'Recognition Breakdown by Type',
    metric: 'recognitionCount',
    groupBy: 'recognitionType',
    chartType: 'doughnut',
    span: 1,
  },
];

function buildMetricChartSpec(widget, dashboard) {
  if (!dashboard) return null;
  const { monthlyTrend = [], departmentBreakdown = [], employeesRanked = [], recognitionByType } = dashboard;
  const { metric, groupBy, chartType, title } = widget;

  if (groupBy === 'month') {
    const labels = monthlyTrend.map((m) => m.shortLabel);
    let data = [];
    let label = 'Value';
    let color = '#7C3AED';

    if (metric === 'netSalesLakhs') {
      label = 'Net Sales (₹ Lakhs)';
      data = monthlyTrend.map((m) => Math.round((m.netSalesInr / 100000) * 10) / 10);
      color = '#10B981';
    } else if (metric === 'attendanceRate') {
      label = 'Attendance %';
      data = monthlyTrend.map((m) => m.attendanceRate);
      color = '#3B82F6';
    } else if (metric === 'recognitionCount') {
      label = 'Recognitions';
      data = monthlyTrend.map((m) => m.recognitionCount);
      color = '#F59E0B';
    } else {
      label = 'Performance %';
      data = monthlyTrend.map((m) => m.performanceScore);
      color = '#7C3AED';
    }

    return { title, type: chartType, labels, datasets: [{ label, data, color, singleColor: true }] };
  }

  if (groupBy === 'department') {
    const labels = departmentBreakdown.map((d) => d.code);
    const colors = departmentBreakdown.map((d) => d.colorHex || '#7C3AED');
    let data = [];
    let label = 'Value';

    if (metric === 'netSalesLakhs') {
      label = 'Net Sales (₹ Lakhs)';
      data = departmentBreakdown.map((d) => Math.round((d.netSalesInr / 100000) * 10) / 10);
    } else if (metric === 'attendanceRate') {
      label = 'Attendance %';
      data = departmentBreakdown.map((d) => d.attendanceRate);
    } else if (metric === 'recognitionCount') {
      label = 'Recognitions';
      data = departmentBreakdown.map((d) => d.recognitionCount);
    } else if (metric === 'avgRating') {
      label = 'Avg Rating (★)';
      data = departmentBreakdown.map((d) => d.avgRating);
    } else {
      label = 'Composite Score %';
      data = departmentBreakdown.map((d) => d.avgPerformanceScore);
    }

    return { title, type: chartType, labels, datasets: [{ label, data, colors }] };
  }

  if (groupBy === 'recognitionType') {
    const items = recognitionByType?.items || [];
    return {
      title,
      type: chartType,
      labels: items.map((i) => i.type),
      datasets: [
        {
          label: 'Recognitions',
          data: items.map((i) => i.count),
          colors: items.map((i) => i.color),
        },
      ],
    };
  }

  // Top Employees
  const sorted = [...employeesRanked];
  if (metric === 'netSalesLakhs') sorted.sort((a, b) => b.metrics.netSalesInr - a.metrics.netSalesInr);
  else if (metric === 'attendanceRate') sorted.sort((a, b) => b.scores.attendanceScore - a.scores.attendanceScore);
  else if (metric === 'avgRating') sorted.sort((a, b) => b.metrics.avgRating - a.metrics.avgRating);
  else if (metric === 'recognitionCount') sorted.sort((a, b) => b.metrics.recognitionPoints - a.metrics.recognitionPoints);

  const top = sorted.slice(0, 8);
  const labels = top.map((e) => e.full_name.split(' ')[0]);
  let data = [];
  let label = 'Value';
  let color = '#7C3AED';

  if (metric === 'netSalesLakhs') {
    label = 'Net Sales (₹ Lakhs)';
    data = top.map((e) => Math.round((e.metrics.netSalesInr / 100000) * 10) / 10);
    color = '#10B981';
  } else if (metric === 'attendanceRate') {
    label = 'Attendance %';
    data = top.map((e) => e.scores.attendanceScore);
    color = '#3B82F6';
  } else if (metric === 'avgRating') {
    label = 'Avg Rating (★)';
    data = top.map((e) => e.metrics.avgRating);
    color = '#F59E0B';
  } else if (metric === 'recognitionCount') {
    label = 'Recognition Points';
    data = top.map((e) => e.metrics.recognitionPoints);
    color = '#EC4899';
  } else {
    label = 'Composite Score %';
    data = top.map((e) => e.scores.compositeScore);
    color = '#7C3AED';
  }

  return { title, type: chartType, labels, datasets: [{ label, data, color }] };
}

const METRIC_LABELS = {
  performanceScore: 'Performance Score %',
  compositeScore: 'Composite Score %',
  netSalesLakhs: 'Net Sales (₹ Lakhs)',
  attendanceRate: 'Attendance Rate %',
  recognitionCount: 'Recognitions / Points',
  avgRating: 'Customer Rating ★',
};

const GROUP_LABELS = {
  department: 'By Department',
  month: 'By Month',
  topEmployees: 'Top 8 Employees',
  recognitionType: 'By Recognition Type',
};

export default function CustomDashboardWorkspace({
  dashboard,
  widgets,
  onChangeWidgets,
  startDate,
  endDate,
  department,
  showToast,
}) {
  const [prompt, setPrompt] = useState('');
  const [promptChartType, setPromptChartType] = useState('bar');
  const [creating, setCreating] = useState(false);

  // Manual builder fields
  const [manualMetric, setManualMetric] = useState('netSalesLakhs');
  const [manualGroup, setManualGroup] = useState('department');
  const [manualChartType, setManualChartType] = useState('bar');

  // Drag & Drop state
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [isExternalDragOver, setIsExternalDragOver] = useState(false);

  async function handleCreateFromPrompt(e, overrideText) {
    e?.preventDefault();
    const q = String(overrideText ?? prompt).trim();
    if (!q || creating) return;
    setCreating(true);
    try {
      const res = await api.queryAi({
        question: q,
        startDate,
        endDate,
        department,
        chartType: promptChartType,
      });
      if (!res.chart) {
        showToast('Could not build a chart for that prompt. Try asking about departments, sales, or top employees.');
        return;
      }
      const newWidget = {
        id: `ai-${Date.now()}`,
        kind: 'ai',
        title: res.chart.title || q,
        chartType: res.chart.type || promptChartType,
        chartSpec: res.chart,
        span: 1,
      };
      onChangeWidgets([newWidget, ...widgets]);
      if (!overrideText) setPrompt('');
      showToast(`Added "${newWidget.title}" (${newWidget.chartType}) to Custom Canvas!`);
    } catch (err) {
      showToast(err.message);
    } finally {
      setCreating(false);
    }
  }

  function handleAddManualChart() {
    const title = `${METRIC_LABELS[manualMetric] || manualMetric} — ${GROUP_LABELS[manualGroup] || manualGroup}`;
    const newWidget = {
      id: `m-${Date.now()}`,
      kind: 'metric',
      title,
      metric: manualMetric,
      groupBy: manualGroup,
      chartType: manualChartType,
      span: 1,
    };
    onChangeWidgets([newWidget, ...widgets]);
    showToast(`Created "${title}" chart!`);
  }

  function handleWidgetTypeChange(id, nextType) {
    onChangeWidgets(
      widgets.map((w) => {
        if (w.id !== id) return w;
        if (w.kind === 'ai') {
          return { ...w, chartType: nextType, chartSpec: { ...w.chartSpec, type: nextType } };
        }
        return { ...w, chartType: nextType };
      })
    );
  }

  function handleToggleSpan(id) {
    onChangeWidgets(widgets.map((w) => (w.id === id ? { ...w, span: w.span === 2 ? 1 : 2 } : w)));
  }

  function handleRemoveWidget(id) {
    onChangeWidgets(widgets.filter((w) => w.id !== id));
  }

  function handleCanvasDrop(e, targetId = null) {
    e.preventDefault();
    setIsExternalDragOver(false);
    setDragOverId(null);

    // Check if dropped from AI Assistant panel
    const externalRaw = e.dataTransfer.getData('application/x-rewardly-chart');
    if (externalRaw) {
      try {
        const spec = JSON.parse(externalRaw);
        const newWidget = {
          id: `drop-${Date.now()}`,
          kind: 'ai',
          title: spec.title || 'AI Generated Chart',
          chartType: spec.type || 'bar',
          chartSpec: spec,
          span: 1,
        };
        if (targetId) {
          const idx = widgets.findIndex((w) => w.id === targetId);
          const copy = [...widgets];
          copy.splice(Math.max(0, idx), 0, newWidget);
          onChangeWidgets(copy);
        } else {
          onChangeWidgets([newWidget, ...widgets]);
        }
        showToast(`Dropped "${newWidget.title}" onto Custom Dashboard!`);
      } catch {}
      setDraggedId(null);
      return;
    }

    // Reorder existing custom chart card
    if (draggedId && targetId && draggedId !== targetId) {
      const fromIdx = widgets.findIndex((w) => w.id === draggedId);
      const toIdx = widgets.findIndex((w) => w.id === targetId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const copy = [...widgets];
        const [moved] = copy.splice(fromIdx, 1);
        copy.splice(toIdx, 0, moved);
        onChangeWidgets(copy);
      }
    }
    setDraggedId(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Always-visible Create Custom Chart Studio */}
      <div className="card custom-creator-card">
        <div className="card-header" style={{ marginBottom: 10 }}>
          <div className="card-title-row">
            <Wand2 size={18} color="#6d28d9" />
            <span>Create Custom Chart — Ask & Choose Chart Type</span>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              onChangeWidgets(DEFAULT_CUSTOM_WIDGETS);
              showToast('Custom dashboard layout reset to defaults.');
            }}
          >
            <RotateCcw size={13} />
            Reset Layout
          </button>
        </div>

        {/* Plain-language Prompt + Chart Type Picker */}
        <form onSubmit={handleCreateFromPrompt} className="custom-prompt-row">
          <input
            type="text"
            className="input"
            style={{ flex: 1, minWidth: 230 }}
            placeholder="Ask to create a chart (e.g. Sales by department, Top 8 staff, Monthly trend)..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="chart-type-pills" role="group" aria-label="Choose chart type">
            {CHART_TYPE_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chart-type-pill ${promptChartType === t.id ? 'active' : ''}`}
                onClick={() => setPromptChartType(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button type="submit" className="btn btn-primary" disabled={creating || !prompt.trim()}>
            <Sparkles size={14} />
            {creating ? 'Creating...' : 'Create Chart'}
          </button>
        </form>

        {/* Manual Metric + Group By + Chart Type Builder */}
        <div className="manual-builder-row">
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Or Build Manually:</span>
          <select className="select" value={manualMetric} onChange={(e) => setManualMetric(e.target.value)}>
            <option value="netSalesLakhs">Net Sales (₹ Lakhs)</option>
            <option value="performanceScore">Composite Performance %</option>
            <option value="attendanceRate">Attendance & Punctuality %</option>
            <option value="recognitionCount">Recognitions / Points</option>
            <option value="avgRating">Customer Rating ★</option>
          </select>

          <select className="select" value={manualGroup} onChange={(e) => setManualGroup(e.target.value)}>
            <option value="department">By Textile Department</option>
            <option value="month">By Month (Trend)</option>
            <option value="topEmployees">Top 8 Employees</option>
            <option value="recognitionType">By Recognition Type</option>
          </select>

          <select className="select" value={manualChartType} onChange={(e) => setManualChartType(e.target.value)}>
            {CHART_TYPE_OPTIONS.map((t) => (
              <option key={t.id} value={t.id}>{t.label} Chart</option>
            ))}
          </select>

          <button type="button" className="btn btn-soft" onClick={handleAddManualChart}>
            <Plus size={14} />
            Add Chart
          </button>
        </div>

        {/* Quick one-click suggestions */}
        <div className="ai-chip-row" style={{ marginTop: 10 }}>
          {[
            'Show recognition trends by department',
            'Top 8 employees by sales',
            'Monthly performance trend',
            'Recognition breakdown by type',
            'Identify attendance coaching gaps',
          ].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="ai-chip"
              onClick={() => handleCreateFromPrompt(null, suggestion)}
            >
              + {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Drag & Drop Canvas Dropzone */}
      <div
        className={`custom-canvas-grid ${isExternalDragOver ? 'drop-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!draggedId) setIsExternalDragOver(true);
        }}
        onDragLeave={() => setIsExternalDragOver(false)}
        onDrop={(e) => handleCanvasDrop(e, null)}
      >
        {widgets.length === 0 ? (
          <div className="card custom-empty-drop">
            <Sparkles size={26} color="var(--primary)" />
            <strong>Your Custom Canvas is empty</strong>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Create a chart above, or drag & drop any chart directly from the AI Assistant on the right!
            </span>
          </div>
        ) : (
          widgets.map((widget) => {
            const spec = widget.kind === 'metric'
              ? buildMetricChartSpec(widget, dashboard)
              : { ...widget.chartSpec, type: widget.chartType };

            return (
              <div
                key={widget.id}
                draggable
                onDragStart={(e) => {
                  setDraggedId(widget.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDragOverId(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (draggedId !== widget.id) setDragOverId(widget.id);
                }}
                onDrop={(e) => {
                  e.stopPropagation();
                  handleCanvasDrop(e, widget.id);
                }}
                className={`card custom-widget-card ${widget.span === 2 ? 'span-2' : ''} ${draggedId === widget.id ? 'dragging' : ''} ${dragOverId === widget.id ? 'drag-over' : ''}`}
              >
                <div className="custom-widget-head">
                  <div className="custom-widget-title-wrap">
                    <span className="drag-handle" title="Drag to reorder">
                      <GripVertical size={16} />
                    </span>
                    <strong style={{ fontSize: 14 }}>{widget.title}</strong>
                  </div>

                  <div className="custom-widget-actions">
                    <select
                      className="select widget-type-select"
                      aria-label={`Chart type for ${widget.title}`}
                      value={widget.chartType}
                      onChange={(e) => handleWidgetTypeChange(widget.id, e.target.value)}
                    >
                      {CHART_TYPE_OPTIONS.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="icon-btn"
                      style={{ width: 28, height: 28 }}
                      title={widget.span === 2 ? 'Half width' : 'Full width'}
                      onClick={() => handleToggleSpan(widget.id)}
                    >
                      {widget.span === 2 ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>

                    <button
                      type="button"
                      className="icon-btn"
                      style={{ width: 28, height: 28 }}
                      title="Remove chart"
                      onClick={() => handleRemoveWidget(widget.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <CustomChartRenderer spec={spec} height={225} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

