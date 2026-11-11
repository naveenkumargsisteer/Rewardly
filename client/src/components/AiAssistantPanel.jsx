import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  CheckCircle2,
  XCircle,
  Lightbulb,
  GripVertical,
  Plus,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import CustomChartRenderer, { CHART_TYPE_OPTIONS } from './CustomChartRenderer';
import { api } from '../api/client';

const INITIAL_PROMPTS = [
  'Show recognition trends by department',
  'Compare loyalty over time',
  'Top 10 recognized employees',
  'Who deserves a festive bonus?',
];

export default function AiAssistantPanel({
  isOpen,
  onToggleOpen,
  activeTab,
  onTabChange,
  dashboardMode,
  startDate,
  endDate,
  department,
  aiInsights,
  rewards,
  onRewardAction,
  onAddChartToCustom,
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hi! I'm your Rewardly AI assistant. Ask me to analyze data or create any chart — pick a chart type below and drag generated charts into your Custom tab!",
      suggestedNextSteps: INITIAL_PROMPTS,
    },
  ]);
  const [input, setInput] = useState('');
  const [selectedChartType, setSelectedChartType] = useState('auto');
  const [asking, setAsking] = useState(false);

  const pendingRewards = (rewards || []).filter((r) => r.status === 'Pending');

  async function sendQuestion(questionText) {
    const q = String(questionText || input).trim();
    if (!q || asking) return;
    setInput('');
    const userMsg = { id: `u-${Date.now()}`, sender: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setAsking(true);

    try {
      const res = await api.queryAi({
        question: q,
        startDate,
        endDate,
        department,
        chartType: selectedChartType,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: res.answer,
          highlights: res.highlights,
          chart: res.chart,
          suggestedNextSteps: res.suggestedNextSteps,
          provider: res.aiProvider,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `b-err-${Date.now()}`,
          sender: 'bot',
          text: `Could not analyze right now: ${err.message}`,
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  function handleChangeMessageChartType(msgId, nextType) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.chart ? { ...m, chart: { ...m.chart, type: nextType } } : m
      )
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        className="ai-floating-launcher"
        onClick={onToggleOpen}
        aria-label="Rewardly AI Assistant"
        title="Rewardly AI Assistant"
      >
        <span className="ai-launcher-icon">
          <img src="/rewardly-logo.png" alt="Rewardly AI" className="ai-logo-img" />
        </span>
        <span className="ai-launcher-expand">
          <span className="ai-launcher-label">Rewardly AI Assistant</span>
          {pendingRewards.length > 0 && (
            <span className="ai-tab-badge">{pendingRewards.length}</span>
          )}
          <ChevronUp size={15} />
        </span>
        {pendingRewards.length > 0 && (
          <span className="ai-launcher-badge-dot">{pendingRewards.length}</span>
        )}
      </button>
    );
  }

  return (
    <aside className="ai-floating-panel" aria-label="Rewardly AI Assistant">
      <div className="ai-floating-header">
        <div className="ai-floating-tabs">
          <button
            type="button"
            className={`ai-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => onTabChange('chat')}
          >
            <Sparkles size={14} />
            AI Chart Assistant
          </button>
          <button
            type="button"
            className={`ai-tab ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => onTabChange('insights')}
          >
            <Lightbulb size={14} />
            AI Insights
            {pendingRewards.length > 0 && (
              <span className="ai-tab-badge">{pendingRewards.length}</span>
            )}
          </button>
        </div>

        <button
          type="button"
          className="ai-collapse-btn"
          onClick={onToggleOpen}
          title="Collapse chatbot"
          aria-label="Collapse AI Assistant"
        >
          <ChevronDown size={17} />
        </button>
      </div>

      {activeTab === 'chat' ? (
        <>
          {dashboardMode === 'custom' && (
            <div className="ai-custom-banner">
              <Sparkles size={13} />
              <span>
                <strong>Custom Mode:</strong> Ask for any chart &amp; drag or add it to your Custom Canvas!
              </span>
            </div>
          )}

          <div className="ai-body">
            {messages.map((m) => (
              <div key={m.id} className={`ai-msg-row ${m.sender === 'user' ? 'user' : ''}`}>
                {m.sender === 'bot' && (
                  <div className="ai-bot-avatar">
                    <img src="/rewardly-logo.png" alt="Rewardly AI" className="ai-logo-img" />
                  </div>
                )}
                <div className={`ai-bubble ${m.sender === 'user' ? 'user' : ''}`}>
                  <div>{m.text}</div>

                  {m.highlights && m.highlights.length > 0 && (
                    <ul style={{ margin: '8px 0 4px', paddingLeft: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                      {m.highlights.map((h, i) => (
                        <li key={i} style={{ marginBottom: 3 }}>{h}</li>
                      ))}
                    </ul>
                  )}

                  {m.chart && (
                    <div
                      className="ai-chart-card"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/x-rewardly-chart', JSON.stringify(m.chart));
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      title="Drag onto the Custom Dashboard canvas"
                    >
                      <div className="ai-chart-head">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                          <GripVertical size={14} color="var(--text-muted)" style={{ cursor: 'grab', flexShrink: 0 }} />
                          <strong style={{ fontSize: 12 }}>{m.chart.title}</strong>
                        </div>
                        <span className="chart-gen-pill">
                          <CheckCircle2 size={11} />
                          Chart Generated
                        </span>
                      </div>

                      <CustomChartRenderer spec={m.chart} height={150} />

                      <div className="ai-chart-footer">
                        <select
                          className="select widget-type-select"
                          aria-label="Change generated chart type"
                          value={m.chart.type || 'bar'}
                          onChange={(e) => handleChangeMessageChartType(m.id, e.target.value)}
                        >
                          {CHART_TYPE_OPTIONS.map((t) => (
                            <option key={t.id} value={t.id}>{t.label}</option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className="btn btn-soft btn-sm"
                          onClick={() => onAddChartToCustom(m.chart)}
                        >
                          <Plus size={12} />
                          Add to Custom
                        </button>
                      </div>
                    </div>
                  )}

                  {m.suggestedNextSteps && m.suggestedNextSteps.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>
                        ✨ Suggested Next Steps:
                      </div>
                      <div className="ai-chip-row">
                        {m.suggestedNextSteps.map((step) => (
                          <button
                            key={step}
                            type="button"
                            className="ai-chip"
                            onClick={() => sendQuestion(step)}
                          >
                            {step}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {asking && (
              <div className="ai-msg-row">
                <div className="ai-bot-avatar loading">
                  <img src="/rewardly-logo.png" alt="Rewardly AI thinking" className="ai-logo-img" />
                </div>
                <div className="ai-bubble">Creating chart from showroom data...</div>
              </div>
            )}
          </div>

          <form
            className="ai-input-bar"
            style={{ flexDirection: 'column', gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                Ask to create chart • Type:
              </span>
              <select
                className="select widget-type-select"
                aria-label="Chart type for AI prompt"
                value={selectedChartType}
                onChange={(e) => setSelectedChartType(e.target.value)}
              >
                <option value="auto">Auto Detect</option>
                {CHART_TYPE_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label} Chart</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="ai-input"
                placeholder="Ask AI to create a chart (e.g. Sales by dept)..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={asking || !input.trim()}
                aria-label="Send question"
              >
                <Send size={15} />
              </button>
            </div>
          </form>
        </>
      ) : (
        <div className="ai-body">
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Automated Workforce Insights
          </div>
          {(aiInsights || []).map((ins) => (
            <div key={ins.id} className={`insight-card ${ins.severity}`}>
              <strong style={{ fontSize: 13 }}>{ins.title}</strong>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                {ins.summary}
              </span>
            </div>
          ))}

          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 6 }}>
            Reward Recommendations ({rewards?.length || 0})
          </div>
          {(rewards || []).map((r) => (
            <div key={r.id} className="reward-queue-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{r.employee_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {r.department_name} • Score {r.composite_score}%
                  </div>
                </div>
                <span className={`status-badge status-${r.status}`}>{r.status}</span>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}>
                {r.reward_title} — ₹{Number(r.bonus_amount_inr).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {r.rationale}
              </div>
              {r.status === 'Pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => onRewardAction(r.id, 'Approved')}
                  >
                    <CheckCircle2 size={13} />
                    Approve Reward
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => onRewardAction(r.id, 'Dismissed')}
                  >
                    <XCircle size={13} />
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
