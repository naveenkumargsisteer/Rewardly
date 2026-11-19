import React from 'react';

export function SkeletonBox({ width = '100%', height = 16, style = {}, borderRadius = 8 }) {
  return (
    <div
      className="skeleton-box"
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

export default function DashboardSkeleton({ isCustom = false }) {
  if (isCustom) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 16 }}>
        {[1, 2, 3, 4].map((k) => (
          <div key={k} className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <SkeletonBox width={140} height={16} />
              <SkeletonBox width={50} height={16} borderRadius={10} />
            </div>
            <SkeletonBox width="100%" height={200} borderRadius={12} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="dashboard-skeleton-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. KPI 4-Card Grid Skeleton */}
      <div className="kpi-grid">
        {[1, 2, 3, 4].map((i) => (
          <div className="kpi-card" key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SkeletonBox width={36} height={36} borderRadius={10} />
              <SkeletonBox width={65} height={18} borderRadius={12} />
            </div>
            <SkeletonBox width={120} height={13} style={{ marginTop: 2 }} />
            <SkeletonBox width={140} height={28} style={{ margin: '2px 0' }} />
            <SkeletonBox width="85%" height={12} borderRadius={4} />
          </div>
        ))}
      </div>

      {/* 2. Row 1: Top Recognized Employees Skeleton + Monthly Sales Revenue Trend Skeleton */}
      <div className="charts-grid-2">
        {/* Top Recognized Employees Skeleton */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SkeletonBox width={18} height={18} borderRadius={4} />
              <SkeletonBox width={180} height={16} />
            </div>
            <SkeletonBox width={85} height={14} borderRadius={6} />
          </div>

          <div className="top-emp-list">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="top-emp-row"
                style={{
                  margin: 0,
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <SkeletonBox width={34} height={34} borderRadius="50%" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <SkeletonBox width="45%" height={14} />
                    <SkeletonBox width="70%" height={11} />
                  </div>
                </div>
                <SkeletonBox width={50} height={22} borderRadius={12} />
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Sales Revenue Trend Chart Skeleton */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SkeletonBox width={18} height={18} borderRadius={4} />
              <SkeletonBox width={210} height={16} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <SkeletonBox width={55} height={24} borderRadius={6} />
              <SkeletonBox width={55} height={24} borderRadius={6} />
            </div>
          </div>

          {/* Shimmering chart simulation */}
          <div
            style={{
              height: 240,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '10px 0',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                height: '78%',
                gap: 14,
                padding: '0 12px',
              }}
            >
              {[40, 70, 85, 95, 60].map((val, idx) => (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  <SkeletonBox
                    width="85%"
                    height={`${val}%`}
                    borderRadius="8px 8px 0 0"
                    style={{ opacity: 0.65 }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0 10px', marginTop: 10 }}>
              {['Jul', 'Aug', 'Sep', 'Oct', 'Nov'].map((m) => (
                <SkeletonBox key={m} width={34} height={12} borderRadius={4} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Row 2: Showroom Growth Analytics Skeleton + Loyalty & Score by Department Skeleton */}
      <div className="charts-grid-2" style={{ marginTop: 16 }}>
        {/* Showroom Growth Analytics Skeleton */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SkeletonBox width={18} height={18} borderRadius={4} />
              <SkeletonBox width={190} height={16} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <SkeletonBox width={85} height={24} borderRadius={6} />
              <SkeletonBox width={65} height={24} borderRadius={6} />
            </div>
          </div>

          {/* Velocity / Avg Growth / Trajectory callout bar skeleton */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              background: '#f8fafc',
              padding: '8px 14px',
              borderRadius: 10,
              marginBottom: 14,
            }}
          >
            {[1, 2, 3].map((b) => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <SkeletonBox width={20} height={20} borderRadius={6} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <SkeletonBox width={65} height={10} />
                  <SkeletonBox width={45} height={12} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ height: 215, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <SkeletonBox width="100%" height="82%" borderRadius={12} />
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
              {['Jul', 'Aug', 'Sep', 'Oct', 'Nov'].map((m) => (
                <SkeletonBox key={m} width={32} height={12} borderRadius={4} />
              ))}
            </div>
          </div>
        </div>

        {/* Loyalty & Score by Department Skeleton */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SkeletonBox width={18} height={18} borderRadius={4} />
              <SkeletonBox width={200} height={16} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <SkeletonBox width={65} height={24} borderRadius={6} />
              <SkeletonBox width={65} height={24} borderRadius={6} />
            </div>
          </div>

          {/* Department bars skeleton */}
          <div
            style={{
              height: 240,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-around',
              padding: '20px 10px 10px',
            }}
          >
            {[75, 90, 85, 30, 95, 70, 80, 50].map((h, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <SkeletonBox
                  width={28}
                  height={`${h * 1.8}px`}
                  borderRadius="6px 6px 0 0"
                />
                <SkeletonBox width={28} height={10} borderRadius={4} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

