import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  GripVertical,
  Lightbulb,
  Plus,
  Send,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import CustomChartRenderer, { CHART_TYPE_OPTIONS } from './CustomChartRenderer';
import { api } from '../api/client';

export const RECOGNITION_AWARD_CATEGORIES = [
  { id: 'all', label: 'All', icon: Sparkles, color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'spotlight', label: 'Employee Spotlight', icon: Award, color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'customer_excellence', label: 'Customer Excellence Champion', icon: Star, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { id: 'sales_achievement', label: 'Sales Achievement Recognition', icon: TrendingUp, color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  { id: 'teamwork', label: 'Teamwork Recognition', icon: Users, color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  { id: 'growth_leadership', label: 'Growth & Leadership Opportunity', icon: Compass, color: '#c026d3', bg: '#fdf4ff', border: '#f5d0fe' },
];

const AWARD_MAPPING_BY_TITLE = {
  'Diwali Bridal Champion Bonus': 'Sales Achievement Recognition',
  'Kanjeevaram Excellence Award': 'Employee Spotlight',
  'Menswear Leadership Trophy': 'Growth & Leadership Opportunity',
  'Rising Star Festive Accelerator': 'Teamwork Recognition',
  'Zero-Error POS & Loyalty Gold': 'Teamwork Recognition',
  'Q3 Silk Mastery Voucher': 'Sales Achievement Recognition',
  'Kids Floor Customer Hero': 'Customer Excellence Champion',
  'Customer Smile Ambassador': 'Customer Excellence Champion',
};

export function getRewardAwardCategory(reward) {
  if (reward.award_type || reward.award_category) {
    return reward.award_type || reward.award_category;
  }
  const cleanTitle = (reward.reward_title || '').trim();
  if (AWARD_MAPPING_BY_TITLE[cleanTitle]) {
    return AWARD_MAPPING_BY_TITLE[cleanTitle];
  }
  for (const [key, val] of Object.entries(AWARD_MAPPING_BY_TITLE)) {
    if (cleanTitle.toLowerCase().includes(key.toLowerCase())) {
      return val;
    }
  }
  const t = cleanTitle.toLowerCase();
  const r = (reward.rationale || '').toLowerCase();
  if (t.includes('spotlight') || t.includes('star of the month') || t.includes('icon') || t.includes('excellence award')) {
    return 'Employee Spotlight';
  }
  if (t.includes('customer') || t.includes('smile') || t.includes('delight') || r.includes('rating') || r.includes('reviews') || t.includes('hero')) {
    return 'Customer Excellence Champion';
  }
  if (t.includes('sales') || t.includes('bonus') || t.includes('target') || t.includes('revenue') || t.includes('mastery') || t.includes('bridal champion')) {
    return 'Sales Achievement Recognition';
  }
  if (t.includes('team') || t.includes('synergy') || t.includes('peer') || t.includes('pos') || t.includes('attendance') || t.includes('accelerator')) {
    return 'Teamwork Recognition';
  }
  if (t.includes('leadership') || t.includes('growth') || t.includes('lead') || t.includes('opportunity') || t.includes('mentor') || t.includes('trophy')) {
    return 'Growth & Leadership Opportunity';
  }
  return 'Employee Spotlight';
}

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
      text: "Hi! I'm your Rewardly AI assistant powered by live AI models. Ask me anything about employee scores, sales, attendance, or department performance — click '✨ Add To Dashboard ' on any chart to pin it directly to your Custom Dashboard!",
      suggestedNextSteps: INITIAL_PROMPTS,
      provider: 'AI Model (Online)',
    },
  ]);
  const [input, setInput] = useState('');
  const [selectedChartType, setSelectedChartType] = useState('auto');
  const [asking, setAsking] = useState(false);
  const [selectedAwardCategory, setSelectedAwardCategory] = useState('all');

  const pendingRewards = (rewards || []).filter((r) => r.status === 'Pending');

  const filteredRewards = (rewards || []).filter((r) => {
    if (selectedAwardCategory === 'all') return true;
    const catObj = RECOGNITION_AWARD_CATEGORIES.find((c) => c.id === selectedAwardCategory);
    return getRewardAwardCategory(r) === catObj?.label;
  });

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
      qLower.includes('Add To Dashboard ') ||
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
          provider: res.aiProvider || 'AI ',
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
            .catch(() => { });
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
            .catch(() => { });
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
                        {m.provider || 'AI '}
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
                          Add To Dashboard
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
                            Add To Dashboard
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
                          Add To Dashboard
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
                <div className="ai-bubble">Checking...</div>
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

          {/* AI Recognition Recommendations Header & Category Filters */}
          <div
            style={{
              marginTop: 14,
              marginBottom: 4,
              padding: '14px 14px 12px',
              background: 'linear-gradient(135deg, #f8f7ff 0%, #f3f0ff 100%)',
              borderRadius: 14,
              border: '1px solid #e9d5ff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} color="#7c3aed" />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1e1b4b', letterSpacing: '-0.01em' }}>
                  AI Recognition Recommendations
                </span>
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: '#ecfdf5',
                  color: '#065f46',
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 12,
                  border: '1px solid #a7f3d0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <Zap size={11} color="#059669" />
                Actionable
              </span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#6b7280', lineHeight: 1.45 }}>
              Suggests personalised recognition based on employee achievements.
            </p>

            {/* 5 Award Category Pills (Wrapped & Never Clipped) */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                paddingTop: 8,
                borderTop: '1px solid rgba(233, 213, 255, 0.7)',
              }}
            >
              {RECOGNITION_AWARD_CATEGORIES.map((cat) => {
                const IconComp = cat.icon;
                const isSelected = selectedAwardCategory === cat.id;
                const count =
                  cat.id === 'all'
                    ? (rewards || []).length
                    : (rewards || []).filter((r) => getRewardAwardCategory(r) === cat.label).length;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedAwardCategory(cat.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      border: isSelected ? `1.5px solid ${cat.color}` : '1px solid #e2e8f0',
                      background: isSelected ? cat.bg : '#ffffff',
                      color: isSelected ? cat.color : '#475569',
                      boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                    title={cat.label}
                  >
                    <IconComp size={12} color={isSelected ? cat.color : '#94a3b8'} />
                    <span>{cat.label}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 10,
                        background: isSelected ? '#ffffff' : '#f1f5f9',
                        color: isSelected ? cat.color : '#64748b',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Award Recommendations List */}
          {filteredRewards.length === 0 ? (
            <div
              style={{
                padding: '16px 12px',
                textAlign: 'center',
                background: '#f8fafc',
                borderRadius: 12,
                border: '1px dashed #cbd5e1',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              No recommendations currently under this category.
            </div>
          ) : (
            filteredRewards.map((r) => {
              const awardCategory = getRewardAwardCategory(r);
              const catConfig =
                RECOGNITION_AWARD_CATEGORIES.find((c) => c.label === awardCategory) ||
                RECOGNITION_AWARD_CATEGORIES[1];
              const BadgeIcon = catConfig.icon;

              return (
                <div
                  key={r.id}
                  className="reward-queue-card"
                  style={{
                    borderLeft: `3.5px solid ${catConfig.color}`,
                    background: '#ffffff',
                    position: 'relative',
                  }}
                >
                  {/* Category Pill + Status Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: catConfig.bg,
                        color: catConfig.color,
                        border: `1px solid ${catConfig.border}`,
                      }}
                    >
                      <BadgeIcon size={11} />
                      {awardCategory}
                    </span>
                    <span className={`status-badge status-${r.status}`}>{r.status}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{r.employee_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {r.department_name} • Score {r.composite_score}%
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#6d28d9', whiteSpace: 'nowrap' }}>
                      ₹{Number(r.bonus_amount_inr).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#4338ca', marginBottom: 4 }}>
                    {r.reward_title}
                  </div>

                  <div style={{ fontSize: 11.5, color: '#4b5563', lineHeight: 1.45, marginBottom: 8 }}>
                    {r.rationale}
                  </div>

                  {r.status === 'Pending' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => onRewardAction(r.id, 'Approved')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11.5 }}
                      >
                        <CheckCircle2 size={13} />
                        Approve Reward
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onRewardAction(r.id, 'Dismissed')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11.5 }}
                      >
                        <XCircle size={13} />
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </aside>
  );
}
