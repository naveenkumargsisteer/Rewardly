import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  QrCode,
  Receipt,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import Tesseract from 'tesseract.js';
import { api, formatInr } from '../api/client';

export default function AttachBillModal({ isOpen, onClose, employee, onSuccess, showToast }) {
  const [step, setStep] = useState('input'); // 'input' | 'success'
  const [billId, setBillId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(employee?.department_name || 'Silk & Sarees');

  // OCR & Image state
  const [receiptImage, setReceiptImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrExtracted, setOcrExtracted] = useState(false);
  const [ocrRawText, setOcrRawText] = useState('');

  // Submit & Error state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const qrCanvasRef = useRef(null);

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setBillId('');
      setAmount('');
      setDate(new Date().toISOString().slice(0, 10));
      setCategory(employee?.department_name || 'Silk & Sarees');
      setReceiptImage(null);
      setImagePreview('');
      setOcrScanning(false);
      setOcrProgress(0);
      setOcrExtracted(false);
      setOcrRawText('');
      setErrorMsg('');
      setSuccessData(null);
      setCopiedLink(false);
    }
  }, [isOpen, employee]);

  // Generate Customer Feedback QR code when reaching 'success' step
  useEffect(() => {
    if (step === 'success' && successData && qrCanvasRef.current) {
      const empCode = employee?.emp_code || 'RW002';
      const billNo = successData.bill?.bill_id || billId;
      const billAmt = successData.bill?.amount || amount;
      const feedbackUrl = `${window.location.origin}/feedback/${encodeURIComponent(empCode)}?bill=${encodeURIComponent(billNo)}&amount=${encodeURIComponent(billAmt)}`;

      QRCode.toCanvas(
        qrCanvasRef.current,
        feedbackUrl,
        {
          width: 200,
          margin: 1.5,
          color: {
            dark: '#1e1b4b',
            light: '#ffffff',
          },
        },
        (err) => {
          if (err) console.error('Failed to generate feedback QR', err);
        }
      );
    }
  }, [step, successData, employee, billId, amount]);

  if (!isOpen) return null;

  // Smart Receipt OCR text extraction logic
  async function processReceiptOcr(file) {
    if (!file) return;
    setReceiptImage(file);
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
    setOcrScanning(true);
    setOcrProgress(5);
    setOcrExtracted(false);
    setErrorMsg('');

    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pct = Math.min(98, Math.round(m.progress * 100));
            setOcrProgress(pct);
          }
        },
      });

      const text = result?.data?.text || '';
      setOcrRawText(text);

      // Extract Bill / Invoice Number
      let detectedBillId = '';
      const billPatterns = [
        /(?:bill|invoice|inv|rcpt|receipt|tax\s*inv|bill\s*no|inv\s*no|bill\s*#|invoice\s*#)[.:\s\-#]*([a-zA-Z0-9\-_/]{3,25})/i,
        /#\s*([0-9]{4,12})/i,
        /\b(INV[-_]?[0-9]{3,12}|BILL[-_]?[0-9]{3,12}|RCP[-_]?[0-9]{3,12})\b/i,
      ];

      for (const pattern of billPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          detectedBillId = match[1].trim().toUpperCase();
          break;
        }
      }

      // If still not found, search lines for alphanumeric token of 5-10 chars with digits
      if (!detectedBillId) {
        const lines = text.split('\n');
        for (const line of lines) {
          if (/no|num|#|id/i.test(line)) {
            const tokenMatch = line.match(/([a-zA-Z0-9\-_]{4,16})/);
            if (tokenMatch && /\d/.test(tokenMatch[1])) {
              detectedBillId = tokenMatch[1].toUpperCase();
              break;
            }
          }
        }
      }

      // Extract Total Bill Amount
      let detectedAmount = 0;
      const totalPatterns = [
        /(?:grand\s*total|net\s*amount|total\s*amount|total\s*payable|amount\s*payable|final\s*total|total)[\s:₹rs\.]*([0-9,]+(?:\.[0-9]{1,2})?)/i,
        /(?:₹|rs\.?)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
      ];

      // Primary check on total keywords
      const primaryMatch = text.match(totalPatterns[0]);
      if (primaryMatch && primaryMatch[1]) {
        const cleanNum = Number(primaryMatch[1].replace(/,/g, ''));
        if (!isNaN(cleanNum) && cleanNum > 0) {
          detectedAmount = Math.round(cleanNum);
        }
      }

      // Secondary fallback: search all currency values and pick the highest realistic total
      if (!detectedAmount) {
        const matches = [...text.matchAll(totalPatterns[1])];
        const amounts = matches
          .map((m) => Number(m[1].replace(/,/g, '')))
          .filter((n) => !isNaN(n) && n >= 50 && n <= 500000);
        if (amounts.length > 0) {
          detectedAmount = Math.round(Math.max(...amounts));
        }
      }

      // Update state if extracted
      if (detectedBillId) {
        setBillId(detectedBillId);
      }
      if (detectedAmount > 0) {
        setAmount(String(detectedAmount));
      }

      if (detectedBillId || detectedAmount > 0) {
        setOcrExtracted(true);
      }
    } catch (err) {
      console.warn('OCR extraction error:', err);
      // Non-blocking: staff can still enter details manually
    } finally {
      setOcrScanning(false);
      setOcrProgress(100);
    }
  }

  function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (file) {
      processReceiptOcr(file);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const cleanBillId = String(billId || '').trim();
    const cleanAmount = Number(amount);

    if (!cleanBillId) {
      setErrorMsg('Please enter or scan a Bill ID / Receipt Number.');
      return;
    }
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      setErrorMsg('Please enter a valid bill amount greater than ₹0.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        employee_id: employee?.id,
        emp_code: employee?.emp_code,
        bill_id: cleanBillId,
        amount: cleanAmount,
        date,
        category: category || employee?.department_name || 'Silk & Sarees',
      };

      const res = await api.attachBill(payload);
      setSuccessData(res);
      setStep('success');

      // Dispatch global event so employee portal and dashboard metrics update immediately
      window.dispatchEvent(new CustomEvent('rewardly:sale_created', { detail: res }));
      onSuccess?.(res);
      showToast?.(`Bill #${cleanBillId} attached! ₹${cleanAmount.toLocaleString('en-IN')} added to your sales.`);
    } catch (err) {
      const msg = err.message || 'Failed to attach bill. Please try again.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const feedbackUrl =
    typeof window !== 'undefined' && employee
      ? `${window.location.origin}/feedback/${encodeURIComponent(employee.emp_code)}?bill=${encodeURIComponent(successData?.bill?.bill_id || billId)}&amount=${encodeURIComponent(successData?.bill?.amount || amount)}`
      : '';

  function handleCopyFeedbackLink() {
    if (!feedbackUrl) return;
    navigator.clipboard.writeText(feedbackUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  function handleAttachAnother() {
    setStep('input');
    setBillId('');
    setAmount('');
    setReceiptImage(null);
    setImagePreview('');
    setOcrExtracted(false);
    setOcrRawText('');
    setErrorMsg('');
    setSuccessData(null);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{
          maxWidth: 540,
          width: '100%',
          borderRadius: 20,
          boxShadow: '0 25px 60px rgba(15, 23, 42, 0.28)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            color: '#ffffff',
            padding: '16px 20px',
            borderBottom: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Receipt size={22} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#ffffff' }}>
                {step === 'input' ? 'Attach & Scan Bill' : 'Bill Attached Successfully!'}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255, 255, 255, 0.85)' }}>
                {step === 'input'
                  ? `Credit sales & generate feedback QR for ${employee?.full_name || 'Staff'}`
                  : `Feedback QR code generated for Customer`}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
            style={{ color: '#ffffff', background: 'rgba(255, 255, 255, 0.15)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* STEP 1: INPUT & SCAN FORM */}
        {step === 'input' && (
          <form onSubmit={handleSubmit} style={{ padding: 22 }}>
            {errorMsg && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '12px 14px',
                  background: '#fef2f2',
                  border: '1.5px solid #f87171',
                  borderRadius: 12,
                  color: '#991b1b',
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong style={{ display: 'block', marginBottom: 2 }}>Attachment Rejected</strong>
                  <span>{errorMsg}</span>
                </div>
              </div>
            )}

            {/* Mobile Scan & Upload Action Buttons */}
            <div
              style={{
                marginBottom: 16,
                padding: '14px 16px',
                background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                borderRadius: 14,
                border: '1px solid #ddd6fe',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5b21b6', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={15} color="#7c3aed" /> Mobile Receipt Scanner (Smart OCR)
                </span>
                {ocrScanning && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Loader2 size={12} className="spin" /> Scanning {ocrProgress}%
                  </span>
                )}
              </div>

              {/* Hidden File Inputs: Camera & File picker */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleFileSelected}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileSelected}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={ocrScanning}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    padding: '9px 12px',
                    fontSize: 12.5,
                    fontWeight: 700,
                    borderRadius: 10,
                  }}
                >
                  <Camera size={16} />
                  <span>Scan via Camera</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={ocrScanning}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    padding: '9px 12px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    borderRadius: 10,
                    background: '#ffffff',
                  }}
                >
                  <Upload size={15} />
                  <span>Upload Receipt</span>
                </button>
              </div>

              {/* Receipt Preview Thumbnail */}
              {imagePreview && (
                <div
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 10px',
                    background: '#ffffff',
                    borderRadius: 10,
                    border: '1px solid #c4b5fd',
                  }}
                >
                  <img
                    src={imagePreview}
                    alt="Receipt thumbnail"
                    style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', truncate: 'true' }}>
                      {receiptImage?.name || 'receipt_capture.jpg'}
                    </div>
                    <div style={{ fontSize: 11, color: ocrExtracted ? '#059669' : '#64748b' }}>
                      {ocrScanning
                        ? `Reading text (${ocrProgress}%)...`
                        : ocrExtracted
                          ? '✨ Details auto-extracted below'
                          : 'Receipt image attached'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview('');
                      setReceiptImage(null);
                      setOcrExtracted(false);
                    }}
                    style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
                    title="Remove image"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </div>

            {/* Bill Verification & Input Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="field-label" htmlFor="bill-id-input" style={{ fontWeight: 700 }}>
                    Bill ID / Receipt Number *
                  </label>
                  {ocrExtracted && billId && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <CheckCircle2 size={12} /> Auto-detected
                    </span>
                  )}
                </div>
                <input
                  id="bill-id-input"
                  type="text"
                  className="input"
                  value={billId}
                  onChange={(e) => setBillId(e.target.value.toUpperCase())}
                  placeholder="e.g. BILL-10824 or INV-2026-90"
                  required
                  style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  * Unique bill constraint: Each bill can only be attached ONCE across the showroom.
                </span>
              </div>

              <div className="form-grid">
                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="field-label" htmlFor="bill-amount-input" style={{ fontWeight: 700 }}>
                      Total Bill Amount (₹) *
                    </label>
                    {ocrExtracted && amount && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <CheckCircle2 size={12} /> Auto-detected
                      </span>
                    )}
                  </div>
                  <input
                    id="bill-amount-input"
                    type="number"
                    min="1"
                    step="1"
                    className="input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 15400"
                    required
                    style={{ fontWeight: 700, fontSize: 15 }}
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="bill-date-input" style={{ fontWeight: 700 }}>
                    Sale Date
                  </label>
                  <input
                    id="bill-date-input"
                    type="date"
                    className="input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="bill-dept-select" style={{ fontWeight: 700 }}>
                  Showroom Department / Category
                </label>
                <select
                  id="bill-dept-select"
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Silk & Sarees">Silk & Sarees</option>
                  <option value="Ethnic & Bridal">Ethnic & Bridal</option>
                  <option value="Menswear & Formals">Menswear & Formals</option>
                  <option value="Wedding">Wedding</option>
                  <option value="Kids & Casuals">Kids & Casuals</option>
                  <option value="Home & Linen">Home & Linen</option>
                  <option value="Billing & Care">Billing & Care</option>
                  <option value="New Born">New Born</option>
                </select>
              </div>

              {/* Staff Attribution Summary */}
              <div
                style={{
                  padding: '10px 14px',
                  background: '#f8fafc',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Crediting Sales to:</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                  {employee?.full_name} ({employee?.emp_code})
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !billId || !amount}
                style={{
                  padding: '9px 20px',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                }}
              >
                {submitting ? 'Attaching Bill...' : 'Attach Bill to My Sales'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: SUCCESS VIEW WITH CUSTOMER FEEDBACK QR CODE */}
        {step === 'success' && (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#ecfdf5',
                color: '#10b981',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <CheckCircle2 size={34} />
            </div>

            <h3 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#1e1b4b' }}>
              ₹{Number(amount).toLocaleString('en-IN')} Credited!
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
              Bill <strong>#{billId}</strong> has been successfully attached to {employee?.full_name}.
            </p>

            {/* QR Code Presentation Box */}
            <div
              style={{
                margin: '0 auto 18px',
                padding: '16px',
                background: '#ffffff',
                borderRadius: 16,
                boxShadow: '0 8px 30px rgba(109, 40, 217, 0.12)',
                border: '2px solid #ede9fe',
                display: 'inline-block',
                maxWidth: 240,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#6d28d9',
                  marginBottom: 8,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Customer Feedback QR
              </div>
              <canvas ref={qrCanvasRef} style={{ display: 'block', margin: '0 auto', borderRadius: 8 }} />
              <div style={{ fontSize: 11, color: '#475569', marginTop: 8, fontWeight: 600 }}>
                Bill #{billId} • {employee?.emp_code}
              </div>
            </div>

            <p style={{ margin: '0 auto 20px', fontSize: 12.5, color: '#4b5563', maxWidth: 380 }}>
              📱 Have the customer scan this QR code with their mobile phone to submit immediate 5★ review & feedback.
            </p>

            {/* Direct Feedback Link Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCopyFeedbackLink}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
              >
                <Copy size={14} />
                <span>{copiedLink ? 'Copied to Clipboard! ✓' : 'Copy Feedback Link'}</span>
              </button>

              <a
                href={feedbackUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, textDecoration: 'none' }}
              >
                <ExternalLink size={14} />
                <span>Open Feedback Form</span>
              </a>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAttachAnother}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={15} />
                <span>Attach Another Bill</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onClose}
                style={{ padding: '8px 24px', fontWeight: 700 }}
              >
                Done & View Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
