import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Award } from 'lucide-react';
import './chartSetup';

function computePercentagesSum100(counts) {
  const total = counts.reduce((sum, c) => sum + (Number(c) || 0), 0);
  if (total <= 0) return counts.map(() => 0);

  const exacts = counts.map((c) => (Math.max(0, Number(c) || 0) / total) * 100);
  const floors = exacts.map((e) => Math.floor(e));
  const remainderNeeded = 100 - floors.reduce((a, b) => a + b, 0);

  const remainders = exacts.map((e, idx) => ({
    idx,
    rem: e - floors[idx],
    count: counts[idx],
  }));

  remainders.sort((a, b) => b.rem - a.rem || b.count - a.count || a.idx - b.idx);

  const result = [...floors];
  for (let i = 0; i < remainderNeeded && i < remainders.length; i++) {
    result[remainders[i].idx] += 1;
  }
  return result;
}

export default function RecognitionDonutCard({ recognitionByType }) {
  const rawItems = recognitionByType?.items || [];
  const items = useMemo(() => {
    if (!rawItems.length) return [];
    const counts = rawItems.map((i) => Number(i.count) || 0);
    const percentages = computePercentagesSum100(counts);
    return rawItems.map((item, idx) => ({
      ...item,
      percentage: percentages[idx],
    }));
  }, [rawItems]);

  const lead = [...items].sort((a, b) => b.percentage - a.percentage)[0];

  const data = {
    labels: items.map((i) => i.type),
    datasets: [
      {
        data: items.map((i) => i.count),
        backgroundColor: items.map((i) => i.color),
        borderWidth: 2,
        borderColor: '#ffffff',
        cutout: '70%',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const item = items[ctx.dataIndex];
            return ` ${item.type}: ${item.count} (${item.percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-row">
          <Award size={17} color="#7c3aed" />
          <span>Recognition by Type</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
          {recognitionByType?.total || 0} Total
        </span>
      </div>

      <div className="donut-layout">
        <div className="donut-wrap">
          <Doughnut data={data} options={options} />
          <div className="donut-center">
            <div className="donut-center-pct">{lead ? `${lead.percentage}%` : '0%'}</div>
            <div className="donut-center-label">{lead?.type || 'None'}</div>
          </div>
        </div>

        <div className="legend-list">
          {items.map((item) => (
            <div className="legend-item" key={item.type}>
              <div className="legend-left">
                <span className="legend-dot" style={{ background: item.color }} />
                <span style={{ fontWeight: 500 }}>{item.type}</span>
              </div>
              <strong className="tabular-nums">{item.percentage}%</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

