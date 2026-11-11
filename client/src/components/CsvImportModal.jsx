import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { api } from '../api/client';

const SAMPLE_CSV = `emp_code,sale_date,bills_count,items_sold,gross_amount_inr,returns_inr,category
RW001,2026-11-11,4,9,58000,0,Kanjeevaram Pure Silk
RW007,2026-11-11,3,6,64500,0,Bridal Lehengas
RW012,2026-11-11,5,11,39000,1500,Raymond & Suiting`;

export default function CsvImportModal({ isOpen, onClose, onSuccess }) {
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  }

  async function handleImport(e) {
    e.preventDefault();
    setImporting(true);
    try {
      const res = await api.importSalesCsv(csvText);
      onSuccess(res);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload size={18} color="#6d28d9" />
            <strong style={{ fontSize: 16 }}>Import POS / Billing Sales CSV</strong>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="modal-body" onSubmit={handleImport} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
            Import daily POS billing data mapped by employee code (<code>RW001</code>–<code>RW030</code>) to update scores and dashboard charts immediately.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="file" accept=".csv,text/csv" onChange={handleFile} style={{ fontSize: 12 }} />
            <button type="button" className="btn btn-sm" onClick={() => setCsvText(SAMPLE_CSV)}>
              Load Sample CSV
            </button>
          </div>

          <textarea
            className="textarea"
            rows={7}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={importing}>
              {importing ? 'Importing...' : 'Import Sales Records'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

