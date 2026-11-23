import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { usePomodoro } from '../context/pomodoro-context';
import { formatHours } from '../utils/format';
import { ChartView } from './chart-view';
import { SessionEditor } from './session-editor';
import { SummaryPeriod } from '../types';

export const SummaryPanel: React.FC = () => {
  const { summary, changeSummaryPeriod, navigateSummary } = usePomodoro();
  const [showEditor, setShowEditor] = useState(false);
  const { activitySummary, chart } = summary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 3 Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div className="card" style={{ padding: '20px 16px', textAlign: 'center' }}>
          <div className="tabular-nums" style={{ fontSize: '28px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {formatHours(activitySummary.hoursFocused)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Hours focused
          </div>
        </div>

        <div className="card" style={{ padding: '20px 16px', textAlign: 'center' }}>
          <div className="tabular-nums" style={{ fontSize: '28px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {activitySummary.daysAccessed}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Days accessed
          </div>
        </div>

        <div className="card" style={{ padding: '20px 16px', textAlign: 'center' }}>
          <div className="tabular-nums" style={{ fontSize: '28px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {activitySummary.dayStreak}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Day streak
          </div>
        </div>
      </div>

      {/* Focus Hours Section */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 500 }}>Focus hours</h3>
          <button
            onClick={() => setShowEditor(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', color: 'var(--color-pomodoro)', fontWeight: 500,
            }}
          >
            <Edit3 size={16} strokeWidth={1.5} />
            <span>Edit sessions</span>
          </button>
        </div>

        {/* Period Selector & Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex', gap: '4px', background: 'var(--color-background-tertiary)',
              padding: '4px', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-hairline)',
            }}
          >
            {(['week', 'month', 'year'] as SummaryPeriod[]).map((p) => {
              const active = chart.period === p;
              const label = p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Year';
              return (
                <button
                  key={p}
                  onClick={() => changeSummaryPeriod(p)}
                  style={{
                    padding: '4px 12px', fontSize: '12px', borderRadius: 'var(--radius-control)',
                    fontWeight: active ? 500 : 400,
                    background: active ? 'var(--color-background-secondary)' : 'transparent',
                    color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    border: active ? '1px solid var(--color-border-subtle)' : '1px solid transparent',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => navigateSummary(-1)}
              title="Previous period"
              style={{
                color: 'var(--color-text-secondary)', padding: '6px',
                borderRadius: 'var(--radius-control)', display: 'flex',
                background: 'var(--color-background-tertiary)',
                border: '1px solid var(--color-border-hairline)',
              }}
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500, minWidth: '90px', textAlign: 'center' }}>
              {chart.rangeLabel}
            </span>
            <button
              onClick={() => navigateSummary(1)}
              title="Next period"
              style={{
                color: 'var(--color-text-secondary)', padding: '6px',
                borderRadius: 'var(--radius-control)', display: 'flex',
                background: 'var(--color-background-tertiary)',
                border: '1px solid var(--color-border-hairline)',
              }}
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Pure HTML/CSS Stacked Bar Chart */}
        <ChartView buckets={chart.buckets} projects={chart.projects} />
      </div>

      {showEditor && <SessionEditor onClose={() => setShowEditor(false)} />}
    </div>
  );
};
