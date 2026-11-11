import React from 'react';

export default function RewardlyLoader({
  message = 'Loading Rewardly...',
  variant = 'card',
}) {
  if (variant === 'pill') {
    return (
      <div className="rewardly-loader-pill" role="status" aria-live="polite">
        <span className="rewardly-loader-mini-wrap" aria-hidden="true">
          <span className="rewardly-loader-orbit mini" />
          <img src="/rewardly-logo.png" alt="" className="rewardly-loader-img mini" />
        </span>
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div
      className={variant === 'compact' ? 'rewardly-loader-compact' : 'card rewardly-loader-card'}
      role="status"
      aria-live="polite"
    >
      <div className="rewardly-loader-stage" aria-hidden="true">
        <span className="rewardly-loader-halo" />
        <span className="rewardly-loader-orbit" />
        <div className="rewardly-loader-badge">
          <img src="/rewardly-logo.png" alt="Rewardly" className="rewardly-loader-img" />
        </div>
      </div>
      <div className="rewardly-loader-text">{message}</div>
      <div className="rewardly-loader-track" aria-hidden="true">
        <div className="rewardly-loader-bar" />
      </div>
    </div>
  );
}
