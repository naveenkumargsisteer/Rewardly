import React from 'react';
import { Trophy, ArrowRight } from 'lucide-react';
import { formatCompactInr } from '../api/client';
import EmployeeAvatar from './EmployeeAvatar';

export default function TopEmployeesCard({ employees, onViewAll, onSelectEmployee }) {
  const topList = (employees || []).slice(0, 8);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-row">
          <Trophy size={17} color="#f59e0b" />
          <span>Top Performing Showroom Staff</span>
        </div>
        <button type="button" className="link-btn" onClick={onViewAll}>
          View All ({employees?.length || 0}) <ArrowRight size={13} />
        </button>
      </div>

      <div className="top-emp-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
        {topList.map((emp) => (
          <div
            key={emp.id}
            className="top-emp-row"
            onClick={() => onSelectEmployee(emp.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelectEmployee(emp.id); }}
            style={{ margin: 0 }}
          >
            <div className="top-emp-left">
              <EmployeeAvatar employee={emp} size={34} />
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

