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

function renderFormattedText(text) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

const INITIAL_PROMPTS = [
  'Who has highest score?',
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
      text: "Hi! I'm your Rewardly AI assistant powered by live AI models. Ask me anything about employee scores, sales, attendance, or department performance — click '✨ Generate Widget' on any chart to pin it directly to your Custom Dashboard!",
      suggestedNextSteps: INITIAL_PROMPTS,
      provider: 'AI Model (Online)',
    },
  ]);
  const [input, setInput] = useState('');
  const [selectedChartType, setSelectedChartType] = useState('auto');
  const [asking, setAsking] = useState(false);

  const pendingRewards = (rewards || []).filter((r) => r.status === 'Pending');

  function handleGenerateWidget(chartSpec) {
    if (!chartSpec) return;
    onAddChartToCustom(chartSpec);
    setMessages((prev) => [
      ...prev,
      {
        id: `b-pin-${Date.now()}`,
        sender: 'bot',
        text: `✨ Successfully created and pinned "${chartSpec.title || 'Chart'}" to your Custom Dashboard canvas! Switched to Custom tab.`,
        provider: 'Custom Dashboard Generator',
      },
    ]);
  }

  async function sendQuestion(questionText) {
    const q = String(questionText || input).trim();
    if (!q || asking) return;
    setInput('');
    const userMsg = { id: `u-${Date.now()}`, sender: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setAsking(true);

    const qLower = q.toLowerCase();
    const isWidgetRequest =
      qLower.includes('generate widget') ||
      qLower.includes('create widget') ||
      qLower.includes('add widget') ||
      qLower.includes('make widget') ||
      qLower.includes('pin widget');

    try {
      // If user typed only a widget generation command, check if we can reuse the last chart
      if (isWidgetRequest) {
        const lastChartMsg = [...messages].reverse().find((m) => m.chart);
        if (lastChartMsg && lastChartMsg.chart) {
          handleGenerateWidget(lastChartMsg.chart);
          setAsking(false);
          return;
        }
      }

      const res = await api.queryAi({
        question: q,
        startDate,
        endDate,
        department,
        chartType: selectedChartType,
      });

      // If user explicitly asks to generate a widget, automatically add it to custom canvas
      if (res.chart && isWidgetRequest) {
        onAddChartToCustom(res.chart);
      }

      const botMsgId = `b-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          sender: 'bot',
          text: res.answer,
          highlights: res.highlights,
          chart: res.chart,
          suggestedNextSteps: res.suggestedNextSteps,
          provider: res.aiProvider || 'AI Model (GPT-4o mini)',
        },
      ]);

      // If server returned non-AI fallback, trigger direct client-side AI chat in browser
      if (res.aiProvider === 'Rewardly Analytics Engine' && res.groundTruthContext) {
        const sysPrompt =
          'You are Rewardly AI for Kaveri Silks & Textiles. Synthesize the owner question conversationally in 2-3 engaging sentences using ONLY the verified database records provided. Bold key names and numbers with markdown.';
        const userPrompt = `Owner Question: "${q}"\nVerified DB Context: ${JSON.stringify(res.groundTruthContext)}`;

        if (window.puter?.ai?.chat) {
          window.puter.ai
            .chat(`${sysPrompt}\n\n${userPrompt}`, { model: 'gpt-4o-mini' })
            .then((resp) => {
              const text = resp?.message?.content || resp?.text || (typeof resp === 'string' ? resp : null);
              if (text && text.trim().length > 15) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botMsgId
                      ? { ...m, text: text.trim(), provider: 'GPT-4o mini (Puter AI)' }
                      : m
                  )
                );
              }
            })
            .catch(() => {});
        } else {
          fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: sysPrompt },
                { role: 'user', content: userPrompt },
              ],
              model: 'openai',
              seed: Math.floor(Math.random() * 1000000),
            }),
          })
            .then((r) => (r.ok ? r.text() : null))
            .then((aiText) => {
              if (aiText && !aiText.includes('Free limit') && !aiText.includes('"error"')) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botMsgId
                      ? { ...m, text: aiText.trim(), provider: 'GPT-4o mini AI (Live)' }
                      : m
                  )
                );
              }
            })
            .catch(() => {});
        }
      }
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
                  {m.sender === 'bot' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10.5,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)',
                          color: '#6d28d9',
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: '1px solid rgba(109, 40, 217, 0.2)',
                        }}
                      >
                        <Sparkles size={11} color="#7c3aed" />
                        {m.provider || 'AI Model (GPT-4o mini)'}
                      </span>
                      {m.chart && (
                        <button
                          type="button"
                          onClick={() => handleGenerateWidget(m.chart)}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: '#7c3aed',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '3px 8px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            boxShadow: '0 1px 3px rgba(124, 58, 237, 0.3)',
                          }}
                          title="Generate and pin to Custom Dashboard"
                        >
                          <Sparkles size={11} />
                          Generate Widget
                        </button>
                      )}
                    </div>
                  )}

                  <div style={{ lineHeight: 1.5 }}>{renderFormattedText(m.text)}</div>

                  {m.highlights && m.highlights.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '9px 0 6px' }}>
                      {m.highlights.map((h, i) => (
                        <span
                          key={i}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            fontSize: 11.5,
                            fontWeight: 600,
                            background: 'rgba(109, 40, 217, 0.08)',
                            color: '#5b21b6',
                            border: '1px solid rgba(109, 40, 217, 0.16)',
                            padding: '3px 8px',
                            borderRadius: 6,
                          }}
                        >
                          {h}
                        </span>
                      ))}
                    </div>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="chart-gen-pill">
                            <CheckCircle2 size={11} />
                            Chart Generated
                          </span>
                          <button
                            type="button"
                            onClick={() => handleGenerateWidget(m.chart)}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              background: '#7c3aed',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '2px 8px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            title="Generate and pin to Custom Dashboard"
                          >
                            <Sparkles size={11} />
                            Generate Widget
                          </button>
                        </div>
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
                          className="btn btn-sm btn-primary"
                          onClick={() => handleGenerateWidget(m.chart)}
                          title="Generate and pin this widget to your Custom Dashboard"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontWeight: 700,
                            padding: '6px 14px',
                            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                            color: '#ffffff',
                            borderRadius: 8,
                            boxShadow: '0 2px 6px rgba(109, 40, 217, 0.25)',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <Sparkles size={13} />
                          Generate Widget
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
