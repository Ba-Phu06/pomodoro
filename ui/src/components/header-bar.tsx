import React from 'react';
import { Timer, BarChart3, Settings, Clock, Pin } from 'lucide-react';
import { usePomodoro } from '../context/pomodoro-context';
import { formatCountdown } from '../utils/format';

export const HeaderBar: React.FC = () => {
  const { tab, setTab, timer, floatingPinned, toggleFloatingPill } = usePomodoro();
  const showCountdownPill = tab !== 'timer';

  const getPillBorder = () => {
    if (timer.mode === 'short_break') return 'var(--color-short-break)';
    if (timer.mode === 'long_break') return 'var(--color-long-break)';
    return 'var(--color-pomodoro)';
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--color-border-hairline)',
        marginBottom: '24px',
        gap: '12px',
      }}
    >
      <nav
        style={{
          display: 'flex',
          gap: '4px',
          background: 'var(--color-background-tertiary)',
          padding: '4px',
          borderRadius: 'var(--radius-control)',
          border: '1px solid var(--color-border-hairline)',
        }}
      >
        <button
          onClick={() => setTab('timer')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: tab === 'timer' ? 500 : 400,
            borderRadius: 'var(--radius-control)',
            backgroundColor: tab === 'timer' ? 'var(--color-background-secondary)' : 'transparent',
            color: tab === 'timer' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          }}
        >
          <Timer size={16} strokeWidth={1.5} />
          <span>Timer</span>
        </button>

        <button
          onClick={() => setTab('summary')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: tab === 'summary' ? 500 : 400,
            borderRadius: 'var(--radius-control)',
            backgroundColor: tab === 'summary' ? 'var(--color-background-secondary)' : 'transparent',
            color: tab === 'summary' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          }}
        >
          <BarChart3 size={16} strokeWidth={1.5} />
          <span>Summary</span>
        </button>

        <button
          onClick={() => setTab('settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: tab === 'settings' ? 500 : 400,
            borderRadius: 'var(--radius-control)',
            backgroundColor: tab === 'settings' ? 'var(--color-background-secondary)' : 'transparent',
            color: tab === 'settings' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          }}
        >
          <Settings size={16} strokeWidth={1.5} />
          <span>Settings</span>
        </button>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {showCountdownPill && (
          <button
            onClick={() => setTab('timer')}
            title="Back to timer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-control)',
              backgroundColor: 'var(--color-background-secondary)',
              border: `1px solid ${getPillBorder()}`,
              color: 'var(--color-text-primary)',
              fontSize: '13px',
            }}
          >
            <Clock size={16} strokeWidth={1.5} style={{ color: getPillBorder() }} />
            <span className="tabular-nums">{formatCountdown(timer.remainingSec)}</span>
          </button>
        )}

        <button
          onClick={toggleFloatingPill}
          title={floatingPinned ? 'Tắt thanh Pomodoro Mini' : 'Ghim thanh Pomodoro Mini'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-control)',
            backgroundColor: floatingPinned ? getPillBorder() : 'var(--color-background-secondary)',
            border: `1px solid ${floatingPinned ? getPillBorder() : 'var(--color-border-hairline)'}`,
            color: floatingPinned ? '#ffffff' : 'var(--color-text-secondary)',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <Pin size={15} strokeWidth={1.5} />
          <span>{floatingPinned ? 'Đang ghim' : 'Ghim Mini'}</span>
        </button>
      </div>
    </header>
  );
};
