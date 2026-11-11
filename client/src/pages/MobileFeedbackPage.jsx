import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  EyeOff,
  MessageSquareHeart,
  Send,
  ShieldCheck,
  Star,
  User,
} from 'lucide-react';
import { api } from '../api/client';
import RewardlyLoader from '../components/RewardlyLoader';

const RATING_LABELS = [
  { min: 4.5, label: 'Outstanding', tone: '#059669' },
  { min: 3.8, label: 'Great Experience', tone: '#7c3aed' },
  { min: 3.0, label: 'Good Service', tone: '#2563eb' },
  { min: 2.0, label: 'Fair', tone: '#d97706' },
  { min: 1.0, label: 'Needs Attention', tone: '#dc2626' },
];

function getRatingMeta(val) {
  return RATING_LABELS.find((item) => val >= item.min) || RATING_LABELS[RATING_LABELS.length - 1];
}

export default function MobileFeedbackPage({ empRef }) {
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [anonymous, setAnonymous] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [rating, setRating] = useState(4.5);
  const [comment, setComment] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedRecord, setSubmittedRecord] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    api.getPublicFeedbackTarget(empRef)
      .then((res) => {
        if (active) setTarget(res);
      })
      .catch((err) => {
        if (active) setLoadError(err.message || 'Unable to load feedback form.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [empRef]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!target?.employee) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const created = await api.submitPublicFeedback({
        emp_code: target.employee.emp_code,
        customer_name: anonymous ? '' : customerName,
        anonymous,
        rating,
        comment,
      });
      setSubmittedRecord(created);
    } catch (err) {
      setSubmitError(err.message || 'Could not submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleResetForm() {
    setSubmittedRecord(null);
    setCustomerName('');
    setAnonymous(false);
    setRating(4.5);
    setComment('');
    setSubmitError('');
  }

  const sliderPct = `${((Math.min(5, Math.max(1, Number(rating))) - 1) / 4) * 100}%`;
  const ratingMeta = getRatingMeta(rating);
  const filledStars = Math.round(rating);

  return (
    <div className="mobile-feedback-shell">
      <div className="mobile-feedback-card">
        <div className="mobile-feedback-brand">
          <div className="mobile-feedback-brand-left">
            <img src="/rewardly-logo.png" alt="Rewardly" />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15.5, color: '#1e1b4b', lineHeight: 1.15 }}>
                Rewardly
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {target?.shop?.name || 'Showroom Customer Feedback'}
              </div>
            </div>
          </div>
          <span className="mobile-feedback-anon-badge">
            <ShieldCheck size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            No Login Needed
          </span>
        </div>

        {loading && (
          <RewardlyLoader variant="compact" message="Preparing feedback card..." />
        )}

        {!loading && loadError && (
          <div className="mobile-feedback-done">
            <div style={{ fontWeight: 700, fontSize: 16, color: '#b91c1c', marginBottom: 6 }}>
              Feedback QR Not Found
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>
              {loadError}
            </p>
          </div>
        )}

        {!loading && !loadError && target && submittedRecord && (
          <div className="mobile-feedback-done">
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.14)',
                color: '#059669',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#1e1b4b' }}>
              Thank You for Your Feedback!
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Your <strong>{Number(submittedRecord.rating).toFixed(1)}★</strong> review for{' '}
              <strong>{target.employee.full_name}</strong> ({target.employee.emp_code}) was
              submitted {submittedRecord.customer_name === 'Anonymous Customer' ? 'anonymously' : `as ${submittedRecord.customer_name}`}.
            </p>
            <button type="button" className="btn btn-primary mobile-feedback-submit" onClick={handleResetForm}>
              Submit Another Rating
            </button>
          </div>
        )}

        {!loading && !loadError && target && !submittedRecord && (
          <form onSubmit={handleSubmit}>
            <div className="mobile-feedback-emp">
              <div
                className="avatar-badge lg"
                style={{ background: target.employee.avatar_color || '#7C3AED' }}
              >
                {target.employee.avatar_initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1e1b4b' }}>
                  {target.employee.full_name}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {target.employee.role}
                  {target.employee.department_name ? ` • ${target.employee.department_name}` : ''}
                </div>
              </div>
              <span className="pill-badge" style={{ fontSize: 11 }}>
                {target.employee.emp_code}
              </span>
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                <label className="field-label" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <User size={13} />
                  Customer Name
                </label>
                <button
                  type="button"
                  className={`anon-chip ${anonymous ? 'active' : ''}`}
                  onClick={() => {
                    const next = !anonymous;
                    setAnonymous(next);
                    if (next) setCustomerName('');
                  }}
                >
                  <EyeOff size={12} />
                  {anonymous ? 'Anonymous On' : 'Stay Anonymous'}
                </button>
              </div>
              <input
                type="text"
                className="input"
                placeholder={anonymous ? 'Submitting as Anonymous Customer' : 'Enter your name (optional)'}
                value={customerName}
                disabled={anonymous}
                maxLength={80}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label className="field-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Star size={13} fill="#f59e0b" color="#f59e0b" />
                Drag to Rate Service Experience
              </label>
              <div className="rating-slider-card">
                <div className="rating-slider-top">
                  <div>
                    <span className="rating-score-big">{Number(rating).toFixed(1)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 4 }}>
                      / 5.0
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 3, marginBottom: 2 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          size={16}
                          fill={n <= filledStars ? '#f59e0b' : 'transparent'}
                          color={n <= filledStars ? '#f59e0b' : '#cbd5e1'}
                        />
                      ))}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: ratingMeta.tone }}>
                      {ratingMeta.label}
                    </div>
                  </div>
                </div>

                <input
                  type="range"
                  min={1}
                  max={5}
                  step={0.1}
                  value={rating}
                  aria-label="Service Rating"
                  className="rating-slider"
                  style={{ '--rating-pct': sliderPct }}
                  onChange={(e) => setRating(Number(e.target.value))}
                />

                <div className="rating-scale-labels">
                  <span>1.0 Poor</span>
                  <span>3.0 Good</span>
                  <span>5.0 Excellent</span>
                </div>
              </div>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label className="field-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <MessageSquareHeart size={13} />
                Note <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>(Optional)</span>
              </label>
              <textarea
                rows={3}
                className="textarea"
                placeholder="Share a quick note about your shopping experience (optional)..."
                value={comment}
                maxLength={500}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            {submitError && (
              <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 10 }}>
                {submitError}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary mobile-feedback-submit"
              disabled={submitting}
            >
              <Send size={15} />
              {submitting ? 'Submitting Feedback...' : 'Submit Feedback'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
