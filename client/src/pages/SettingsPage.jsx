import React, { useEffect, useState } from 'react';
import {
  Link2, Copy, Check, ExternalLink, Play, Sliders, Store, Database,
  RefreshCw, FileCode2, ShieldCheck, Terminal,
} from 'lucide-react';
import { api } from '../api/client';

function shiftDate(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export default function SettingsPage({ departments, onSettingsSaved, showToast }) {
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState(null);
  const [settings, setSettings] = useState(null);
  const [counts, setCounts] = useState(null);
  const [dateBounds, setDateBounds] = useState({ minDate: '2026-07-12', maxDate: '2026-11-11' });
  const [backend, setBackend] = useState(null);

  // Exposed API Link Builder State
  const [apiStartDate, setApiStartDate] = useState('2026-07-12');
  const [apiEndDate, setApiEndDate] = useState('2026-11-11');
  const [apiDepartment, setApiDepartment] = useState('all');
  const [apiInclude, setApiInclude] = useState('all');
  const [apiFormat, setApiFormat] = useState('json');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Supabase Tester & Schema Viewer
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');
  const [sbTestResult, setSbTestResult] = useState(null);
  const [schemaText, setSchemaText] = useState('');
  const [showSchema, setShowSchema] = useState(false);
  const [savingWeights, setSavingWeights] = useState(false);
  const [savingShop, setSavingShop] = useState(false);
  const [reseeding, setReseeding] = useState(false);

  async function loadSettings() {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setShop(data.shop);
      setSettings(data.settings);
      setCounts(data.counts);
      setDateBounds(data.dateBounds);
      setBackend(data.backend);
      setApiStartDate(data.dateBounds.minDate);
      setApiEndDate(data.dateBounds.maxDate);
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  if (loading || !settings || !shop) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading Rewardly settings...
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const queryParams = new URLSearchParams({
    startDate: apiStartDate,
    endDate: apiEndDate,
    department: apiDepartment,
    include: apiInclude,
    format: apiFormat,
  });
  if (settings.require_export_token && settings.public_export_token) {
    queryParams.set('apiKey', settings.public_export_token);
  }
  const exposedApiUrl = `${origin}/api/public/export?${queryParams.toString()}`;
  const curlCommand = `curl -s "${exposedApiUrl}"`;

  async function copyText(text, which) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    if (which === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      showToast('Exposed Date-Range API link copied to clipboard!');
    } else {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
      showToast('cURL command copied!');
    }
  }

  async function handleTestApiPreview() {
    setPreviewLoading(true);
    try {
      const res = await fetch(exposedApiUrl);
      const raw = await res.text();
      if (apiFormat === 'csv') {
        setPreviewData({ isCsv: true, text: raw.split('\n').slice(0, 15).join('\n') });
      } else {
        const json = JSON.parse(raw);
        // Trim large record arrays in UI preview while preserving exact meta counts
        const summaryView = {
          meta: json.meta,
          kpis: json.kpis,
          departments: json.departments?.slice(0, 3),
          employees_sample: json.employees?.slice(0, 2),
          sales_records_sample: json.sales_records?.slice(0, 2),
          attendance_records_sample: json.attendance_records?.slice(0, 2),
          customer_feedback_sample: json.customer_feedback?.slice(0, 2),
          recognitions_sample: json.recognitions?.slice(0, 2),
        };
        setPreviewData({
          isCsv: false,
          counts: json.meta?.record_counts,
          text: JSON.stringify(summaryView, null, 2),
        });
      }
      showToast('Live API response fetched successfully!');
    } catch (err) {
      showToast(`Preview failed: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  }

  const totalWeight =
    Number(settings.sales_weight) +
    Number(settings.attendance_weight) +
    Number(settings.feedback_weight) +
    Number(settings.recognition_weight);

  async function handleSaveSettings(e) {
    e?.preventDefault();
    setSavingWeights(true);
    try {
      const updated = await api.updateSettings({ settings });
      setSettings(updated.settings);
      onSettingsSaved();
      showToast('Performance weights & API token settings saved!');
    } catch (err) {
      showToast(err.message);
    } finally {
      setSavingWeights(false);
    }
  }

  async function handleSaveShop(e) {
    e.preventDefault();
    setSavingShop(true);
    try {
      const updated = await api.updateSettings({ shop });
      setShop(updated.shop);
      onSettingsSaved();
      showToast('Showroom profile updated!');
    } catch (err) {
      showToast(err.message);
    } finally {
      setSavingShop(false);
    }
  }

  async function handleToggleToken(checked) {
    const nextSettings = { ...settings, require_export_token: checked };
    setSettings(nextSettings);
    try {
      const updated = await api.updateSettings({ settings: { require_export_token: checked } });
      setSettings(updated.settings);
      showToast(checked ? 'API Key protection enabled on Export API' : 'Open access enabled on Export API');
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleTestSupabase(e) {
    e.preventDefault();
    setSbTestResult({ ok: null, message: 'Testing connection...' });
    try {
      const res = await api.testSupabase({ url: sbUrl, key: sbKey });
      setSbTestResult(res);
    } catch (err) {
      setSbTestResult({ ok: false, message: err.message });
    }
  }

  async function handleViewSchema() {
    if (!showSchema && !schemaText) {
      try {
        const sql = await api.getSupabaseSchema();
        setSchemaText(sql);
      } catch (err) {
        showToast(err.message);
        return;
      }
    }
    setShowSchema((v) => !v);
  }

  async function handleReseed() {
    if (!window.confirm('Reset and re-seed all 4 months of data for 30 Indian employees?')) return;
    setReseeding(true);
    try {
      const res = await api.resetSeed();
      await loadSettings();
      onSettingsSaved();
      showToast(`Re-seeded ${res.employees} employees and ${res.sales_records} sales records!`);
    } catch (err) {
      showToast(err.message);
    } finally {
      setReseeding(false);
    }
  }

  return (
    <div className="settings-grid">
      {/* 1. EXPOSED DATE-RANGE EXPORT API WITH COPY LINK */}
      <div className="card col-12">
        <div className="card-header">
          <div className="section-title-wrap">
            <div className="section-icon">
              <Link2 size={18} />
            </div>
            <div>
              <h2 className="section-title">Exposed Date-Range Data Export API (Copy Link)</h2>
              <p className="section-sub">
                Filter all showroom data (KPIs, 30 employees, sales, attendance, customer feedback, recognitions & rewards) by date range and copy the live REST API link.
              </p>
            </div>
          </div>
          <span className="brand-badge">GET /api/public/export</span>
        </div>

        <div className="api-box">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>Quick Date Presets:</span>
            <button
              type="button"
              className="ai-chip"
              onClick={() => { setApiStartDate(dateBounds.minDate); setApiEndDate(dateBounds.maxDate); }}
            >
              All 4 Months ({dateBounds.minDate} to {dateBounds.maxDate})
            </button>
            <button
              type="button"
              className="ai-chip"
              onClick={() => { setApiStartDate(shiftDate(dateBounds.maxDate, -59)); setApiEndDate(dateBounds.maxDate); }}
            >
              Last 60 Days
            </button>
            <button
              type="button"
              className="ai-chip"
              onClick={() => { setApiStartDate(shiftDate(dateBounds.maxDate, -29)); setApiEndDate(dateBounds.maxDate); }}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              className="ai-chip"
              onClick={() => { setApiStartDate('2026-10-01'); setApiEndDate(dateBounds.maxDate); }}
            >
              Festive Season (Oct–Nov)
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            <div className="field">
              <label className="field-label">Start Date</label>
              <input
                type="date"
                className="input"
                value={apiStartDate}
                max={apiEndDate}
                onChange={(e) => setApiStartDate(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label">End Date</label>
              <input
                type="date"
                className="input"
                value={apiEndDate}
                min={apiStartDate}
                onChange={(e) => setApiEndDate(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label">Department</label>
              <select className="select" value={apiDepartment} onChange={(e) => setApiDepartment(e.target.value)}>
                <option value="all">All Departments</option>
                {(departments || []).map((d) => (
                  <option key={d.id} value={d.code}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label">Dataset Scope</label>
              <select className="select" value={apiInclude} onChange={(e) => setApiInclude(e.target.value)}>
                <option value="all">All Data (Full Dump)</option>
                <option value="summary,departments,employees">Summary + Employees Only</option>
                <option value="sales,attendance">Sales + Attendance Logs</option>
                <option value="feedback,recognitions,rewards">Feedback + Recognitions + Rewards</option>
              </select>
            </div>

            <div className="field">
              <label className="field-label">Format</label>
              <select className="select" value={apiFormat} onChange={(e) => setApiFormat(e.target.value)}>
                <option value="json">JSON (All Datasets)</option>
                <option value="csv">CSV (Employee Scorecard)</option>
              </select>
            </div>
          </div>

          {/* API Key Toggle */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(settings.require_export_token)}
                onChange={(e) => handleToggleToken(e.target.checked)}
              />
              <ShieldCheck size={15} color="var(--primary)" />
              Require API Key (<code>apiKey</code>) on Export Endpoint
            </label>
            {settings.require_export_token && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  className="input"
                  style={{ width: 220, height: 32, fontSize: 12 }}
                  value={settings.public_export_token}
                  onChange={(e) => setSettings({ ...settings, public_export_token: e.target.value })}
                />
                <button type="button" className="btn btn-sm" onClick={handleSaveSettings}>Save Token</button>
              </div>
            )}
          </div>

          {/* Live Constructed URL Box */}
          <div className="api-url-display" data-testid="exposed-api-url">
            {exposedApiUrl}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => copyText(exposedApiUrl, 'link')}
            >
              {copiedLink ? <Check size={15} /> : <Copy size={15} />}
              {copiedLink ? 'Copied API Link!' : 'Copy API Link'}
            </button>

            <button
              type="button"
              className="btn btn-soft"
              onClick={handleTestApiPreview}
              disabled={previewLoading}
            >
              <Play size={15} />
              {previewLoading ? 'Fetching...' : 'Test & Preview Response'}
            </button>

            <a
              href={exposedApiUrl}
              target="_blank"
              rel="noreferrer"
              className="btn"
            >
              <ExternalLink size={15} />
              Open Link in New Tab
            </a>

            <button
              type="button"
              className="btn"
              onClick={() => copyText(curlCommand, 'curl')}
            >
              {copiedCurl ? <Check size={15} /> : <Terminal size={15} />}
              {copiedCurl ? 'Copied cURL!' : 'Copy cURL'}
            </button>
          </div>

          {previewData && (
            <div>
              {previewData.counts && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {Object.entries(previewData.counts).map(([k, v]) => (
                    <span key={k} className="brand-badge">
                      {k}: <strong>{v}</strong>
                    </span>
                  ))}
                </div>
              )}
              <pre className="json-preview">{previewData.text}</pre>
            </div>
          )}
        </div>
      </div>

      {/* 2. CONFIGURABLE PERFORMANCE SCORE WEIGHTS */}
      <form className="card col-6" onSubmit={handleSaveSettings}>
        <div className="card-header">
          <div className="card-title-row">
            <Sliders size={18} color="#6d28d9" />
            <span>Configurable Performance Score Weights</span>
          </div>
          <span className={`status-badge ${totalWeight === 100 ? 'status-Approved' : 'status-Pending'}`}>
            Total: {totalWeight}%
          </span>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 0 }}>
          Adjust how Rewardly computes each employee&apos;s composite score across Sales, Attendance, Customer Feedback, and Recognition.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { key: 'sales_weight', label: 'Showroom Net Sales Target Weight (%)' },
            { key: 'attendance_weight', label: 'Attendance & Punctuality Weight (%)' },
            { key: 'feedback_weight', label: 'Customer Feedback Rating Weight (%)' },
            { key: 'recognition_weight', label: 'Peer & Manager Recognition Weight (%)' },
          ].map((item) => (
            <div className="field" key={item.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{item.label}</span>
                <strong className="tabular-nums">{settings[item.key]}%</strong>
              </div>
              <div className="slider-row">
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={settings[item.key]}
                  onChange={(e) => setSettings({ ...settings, [item.key]: Number(e.target.value) })}
                />
              </div>
            </div>
          ))}

          <div className="form-grid">
            <div className="field">
              <label className="field-label">Gold Reward Tier Threshold (%)</label>
              <input
                type="number"
                className="input"
                min={50}
                max={99}
                value={settings.gold_threshold}
                onChange={(e) => setSettings({ ...settings, gold_threshold: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label className="field-label">Silver Tier Threshold (%)</label>
              <input
                type="number"
                className="input"
                min={40}
                max={95}
                value={settings.silver_threshold}
                onChange={(e) => setSettings({ ...settings, silver_threshold: Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={savingWeights || totalWeight <= 0}>
              {savingWeights ? 'Saving...' : 'Save & Recalculate Scores'}
            </button>
          </div>
        </div>
      </form>

      {/* 3. SHOWROOM PROFILE */}
      <form className="card col-6" onSubmit={handleSaveShop}>
        <div className="card-header">
          <div className="card-title-row">
            <Store size={18} color="#3b82f6" />
            <span>Textile Showroom Profile</span>
          </div>
          <span className="brand-badge">{shop.currency || 'INR'} ₹</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field-label">Showroom Name</label>
            <input
              type="text"
              className="input"
              value={shop.name}
              onChange={(e) => setShop({ ...shop, name: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="field-label">Tagline</label>
            <input
              type="text"
              className="input"
              value={shop.tagline || ''}
              onChange={(e) => setShop({ ...shop, tagline: e.target.value })}
            />
          </div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label">Branch / Location</label>
              <input
                type="text"
                className="input"
                value={shop.location || ''}
                onChange={(e) => setShop({ ...shop, location: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-label">City</label>
              <input
                type="text"
                className="input"
                value={shop.city || ''}
                onChange={(e) => setShop({ ...shop, city: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Owner / Admin Name</label>
            <input
              type="text"
              className="input"
              value={shop.owner_name || ''}
              onChange={(e) => setShop({ ...shop, owner_name: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="submit" className="btn btn-primary" disabled={savingShop}>
              {savingShop ? 'Saving...' : 'Save Showroom Profile'}
            </button>
          </div>
        </div>
      </form>

      {/* 4. SUPABASE SCHEMA, CONNECTION & SEED DATA */}
      <div className="card col-12">
        <div className="card-header">
          <div className="card-title-row">
            <Database size={18} color="#10b981" />
            <span>Supabase Schema, Data Backend & 4-Month Seed Manager</span>
          </div>
          <span className="status-badge status-Approved">Active: {backend?.label}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          <div>
            <strong style={{ fontSize: 13 }}>Seeded Database Records ({dateBounds.minDate} to {dateBounds.maxDate})</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {counts && Object.entries(counts).map(([k, v]) => (
                <span key={k} className="brand-badge">
                  {k}: <strong>{v.toLocaleString('en-IN')}</strong>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
              <button type="button" className="btn btn-soft" onClick={handleViewSchema}>
                <FileCode2 size={15} />
                {showSchema ? 'Hide Supabase schema.sql' : 'View Supabase schema.sql'}
              </button>
              <button type="button" className="btn" onClick={handleReseed} disabled={reseeding}>
                <RefreshCw size={15} />
                {reseeding ? 'Re-seeding...' : 'Reset & Re-seed 4-Month Data'}
              </button>
            </div>
          </div>

          <form onSubmit={handleTestSupabase} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <strong style={{ fontSize: 13 }}>Test Live Supabase Connection (Optional Cloud Mode)</strong>
            <input
              type="url"
              className="input"
              placeholder="SUPABASE_URL (https://xxxx.supabase.co)"
              value={sbUrl}
              onChange={(e) => setSbUrl(e.target.value)}
            />
            <input
              type="password"
              className="input"
              placeholder="SUPABASE_ANON_KEY or SERVICE_ROLE_KEY"
              value={sbKey}
              onChange={(e) => setSbKey(e.target.value)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="submit" className="btn btn-sm btn-primary">Test Connection</button>
              {sbTestResult && (
                <span style={{ fontSize: 12, color: sbTestResult.ok ? '#059669' : '#dc2626', fontWeight: 600 }}>
                  {sbTestResult.message}
                </span>
              )}
            </div>
          </form>
        </div>

        {showSchema && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>supabase/schema.sql</span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(schemaText);
                  showToast('Supabase schema.sql copied!');
                }}
              >
                <Copy size={13} /> Copy SQL
              </button>
            </div>
            <pre className="json-preview">{schemaText}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

