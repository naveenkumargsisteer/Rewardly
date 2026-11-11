import React from 'react';
import { Trophy, ArrowRight } from 'lucide-react';
import { formatCompactInr } from '../api/client';

export default function TopEmployeesCard({ employees, onViewAll, onSelectEmployee }) {
  const topFive = (employees || []).slice(0, 5);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-row">
          <Trophy size={17} color="#f59e0b" />
          <span>Top Recognized Employees</span>
        </div>
        <button type="button" className="link-btn" onClick={onViewAll}>
          View All ({employees?.length || 0}) <ArrowRight size={13} />
        </button>
      </div>

      <div className="top-emp-list">
        {topFive.map((emp) => (
          <div
            key={emp.id}
            className="top-emp-row"
            onClick={() => onSelectEmployee(emp.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelectEmployee(emp.id); }}
          >
            <div className="top-emp-left">
              <span
                className="avatar"
                style={{ background: emp.avatar_color }}
              >
                {emp.avatar_initials}
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="emp-name">
                  #{emp.rank} {emp.full_name}
                </div>
                <div className="emp-meta">
                  {emp.role} • {emp.department_name} • {formatCompactInr(emp.metrics.netSalesInr)}
                </div>
              </div>
            </div>
            <span className="score-pill tabular-nums">{emp.scores.compositeScore}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

