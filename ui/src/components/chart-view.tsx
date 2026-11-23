import React, { useState } from 'react';
import { SummaryBucket } from '../types';

interface ChartViewProps {
  buckets: SummaryBucket[];
  projects: string[];
}

const NEUTRAL_PALETTE = [
  'var(--color-pomodoro)',
  '#6b6b7a',
  '#4d4d5a',
  '#383844',
  '#828292',
];

export const ChartView: React.FC<ChartViewProps> = ({ buckets, projects }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = Math.max(1, ...buckets.map((b) => b.totalHours));
  const ceilHours = Math.ceil(maxVal);
  const midHours = Math.round((ceilHours / 2) * 10) / 10;

  const projectColorMap = projects.reduce<Record<string, string>>((acc, proj, idx) => {
    acc[proj] = NEUTRAL_PALETTE[idx % NEUTRAL_PALETTE.length];
    return acc;
  }, {});

  const isDense = buckets.length > 14;

  const shouldShowLabel = (b: SummaryBucket, idx: number) => {
    if (!isDense) return true;
    if (b.isToday) return true;
    return idx === 0 || (idx + 1) % 5 === 0 || idx === buckets.length - 1;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Chart Canvas with Pure HTML/CSS */}
      <div style={{ display: 'flex', gap: '8px', height: '160px', position: 'relative' }}>
        {/* Y-axis Ticks */}
        <div
          style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            width: '28px', textAlign: 'right', fontSize: '10px',
            color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)',
            paddingBottom: '24px', userSelect: 'none',
          }}
        >
          <span>{ceilHours}h</span>
          <span>{midHours}h</span>
          <span>0h</span>
        </div>

        {/* Bars Container */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* Horizontal Gridlines */}
          <div style={{ position: 'absolute', inset: '0 0 24px 0', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, borderTop: '1px dashed var(--color-border-hairline)' }} />
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed var(--color-border-hairline)' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderTop: '1px solid var(--color-border-subtle)' }} />
          </div>

          {/* Bar Columns */}
          <div
            style={{
              flex: 1, display: 'flex', alignItems: 'flex-end',
              gap: isDense ? '2px' : '6px', paddingBottom: '24px', position: 'relative',
            }}
          >
            {buckets.map((b, idx) => {
              const totalHeightPct = ceilHours > 0 ? (b.totalHours / ceilHours) * 100 : 0;
              const isToday = b.isToday;

              return (
                <div
                  key={b.key}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{
                    flex: 1, height: '100%', display: 'flex',
                    alignItems: 'flex-end', justifyContent: 'center',
                    cursor: 'pointer', position: 'relative',
                  }}
                >
                  {/* Stacked Bar */}
                  <div
                    style={{
                      width: '100%', maxWidth: isDense ? '12px' : '24px',
                      height: `${Math.max(b.totalHours > 0 ? 4 : 0, totalHeightPct)}%`,
                      display: 'flex', flexDirection: 'column-reverse',
                      borderRadius: '3px 3px 0 0', overflow: 'hidden',
                      background: isToday && b.totalHours === 0 ? 'var(--color-pomodoro-subtle)' : 'transparent',
                    }}
                  >
                    {projects.map((proj) => {
                      const projHours = b.byProject?.[proj] || 0;
                      if (projHours <= 0) return null;
                      const segPct = b.totalHours > 0 ? (projHours / b.totalHours) * 100 : 0;
                      return (
                        <div
                          key={proj}
                          style={{
                            height: `${segPct}%`,
                            background: isToday ? 'var(--color-pomodoro)' : projectColorMap[proj],
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Native HTML X-axis Label */}
                  <div
                    style={{
                      position: 'absolute', bottom: '-22px',
                      fontSize: '11px', textAlign: 'center',
                      color: isToday ? 'var(--color-pomodoro)' : 'var(--color-text-secondary)',
                      fontWeight: isToday ? 600 : 400,
                      whiteSpace: 'nowrap', userSelect: 'none',
                    }}
                  >
                    {shouldShowLabel(b, idx) ? b.label.split(' ')[0] : ''}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hover Tooltip */}
          {hoveredIdx !== null && buckets[hoveredIdx] && (
            <div
              style={{
                position: 'absolute', top: '8px', right: '8px',
                background: 'var(--color-background-tertiary)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-control)', padding: '8px 12px',
                fontSize: '11px', pointerEvents: 'none', zIndex: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}
            >
              <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                {buckets[hoveredIdx].label}
              </div>
              <div className="tabular-nums" style={{ color: 'var(--color-pomodoro)', marginTop: '2px' }}>
                {buckets[hoveredIdx].totalHours.toFixed(1)} hours focused
              </div>
              {Object.entries(buckets[hoveredIdx].byProject || {}).map(([p, h]) => (
                <div key={p} style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {p}: {h.toFixed(1)}h
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project Legend */}
      {projects.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '4px' }}>
          {projects.map((proj) => (
            <div key={proj} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: projectColorMap[proj] }} />
              <span>{proj}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
