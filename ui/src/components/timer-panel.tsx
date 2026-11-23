import React from 'react';
import { Play, Pause, RotateCcw, SkipForward, CheckCircle2, X } from 'lucide-react';
import { usePomodoro } from '../context/pomodoro-context';
import { formatCountdown } from '../utils/format';
import { getDurationSecForMode } from '../utils/timer-helpers';
import { TaskList } from './task-list';

export const TimerPanel: React.FC = () => {
  const {
    timer, settings, tasks, toast, clearToast,
    startTimer, pauseTimer, resetTimer, skipTimer, changeMode, applyPreset,
  } = usePomodoro();

  const totalSec = getDurationSecForMode(timer.mode, settings);
  const progressRatio = totalSec > 0 ? Math.max(0, Math.min(1, timer.remainingSec / totalSec)) : 0;
  const radius = 106;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - progressRatio);
  const activeTask = tasks.find((t) => t.id === timer.activeTaskId);

  const getAccentColor = () => {
    if (timer.mode === 'short_break') return 'var(--color-short-break)';
    if (timer.mode === 'long_break') return 'var(--color-long-break)';
    return 'var(--color-pomodoro)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {toast && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-hairline)',
            borderLeft: `4px solid ${getAccentColor()}`, borderRadius: 'var(--radius-control)',
            padding: '12px 16px', fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} strokeWidth={1.5} style={{ color: getAccentColor() }} />
            <span>{toast}</span>
          </div>
          <button onClick={clearToast} style={{ color: 'var(--color-text-secondary)', padding: '4px' }}>
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      )}

      <div className="timer-grid">
        {/* Left Column: Dial & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          {/* Mode Switcher */}
          <div
            style={{
              display: 'flex', gap: '4px', background: 'var(--color-background-tertiary)',
              padding: '4px', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-hairline)',
            }}
          >
            {(['pomodoro', 'short_break', 'long_break'] as const).map((m) => {
              const isActive = timer.mode === m;
              const label = m === 'pomodoro' ? 'Pomodoro' : m === 'short_break' ? 'Short break' : 'Long break';
              return (
                <button
                  key={m}
                  onClick={() => changeMode(m)}
                  style={{
                    padding: '6px 12px', fontSize: '12px', fontWeight: isActive ? 500 : 400,
                    borderRadius: 'var(--radius-control)',
                    backgroundColor: isActive ? 'var(--color-background-secondary)' : 'transparent',
                    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    border: isActive ? '1px solid var(--color-border-subtle)' : '1px solid transparent',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Quick Presets */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => applyPreset(25, 5)}
              style={{
                fontSize: '11px', padding: '4px 12px', borderRadius: 'var(--radius-control)',
                background: settings.pomodoroMin === 25 ? 'var(--color-background-tertiary)' : 'transparent',
                border: '1px solid var(--color-border-hairline)', color: 'var(--color-text-secondary)',
              }}
            >
              25 / 5 min
            </button>
            <button
              onClick={() => applyPreset(40, 5)}
              style={{
                fontSize: '11px', padding: '4px 12px', borderRadius: 'var(--radius-control)',
                background: settings.pomodoroMin === 40 ? 'var(--color-background-tertiary)' : 'transparent',
                border: '1px solid var(--color-border-hairline)', color: 'var(--color-text-secondary)',
              }}
            >
              40 / 5 min
            </button>
          </div>

          {/* Calibrated Chronometer Dial */}
          <div style={{ position: 'relative', width: '260px', height: '260px' }}>
            <svg width="260" height="260" style={{ transform: 'rotate(-90deg)' }}>
              {/* 60 Minute Tick Marks */}
              {Array.from({ length: 60 }).map((_, i) => {
                const angle = i * 6;
                const rad = ((angle - 90) * Math.PI) / 180;
                const isFifth = i % 5 === 0;
                const rOuter = 124;
                const rInner = isFifth ? 114 : 118;
                const x1 = 130 + rInner * Math.cos(rad);
                const y1 = 130 + rInner * Math.sin(rad);
                const x2 = 130 + rOuter * Math.cos(rad);
                const y2 = 130 + rOuter * Math.sin(rad);
                return (
                  <line
                    key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="var(--color-text-muted)"
                    strokeWidth={isFifth ? 1.5 : 1}
                    strokeOpacity={isFifth ? 0.5 : 0.2}
                  />
                );
              })}

              {/* Progress Arc */}
              <circle
                cx="130" cy="130" r={radius} fill="none"
                stroke={getAccentColor()} strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 300ms cubic-bezier(0.2, 0, 0, 1)' }}
              />
            </svg>

            {/* Dial Center Info */}
            <div
              style={{
                position: 'absolute', inset: 0, display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div className="dial-countdown">
                {formatCountdown(timer.remainingSec)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                Session #{timer.completedCount + 1} · {timer.mode === 'pomodoro' ? 'Focus session' : 'Break'}
              </div>
              {activeTask && (
                <div
                  style={{
                    fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px',
                    maxWidth: '190px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  Focus: {activeTask.title}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={resetTimer} title="Reset timer"
              style={{
                width: '40px', height: '40px', borderRadius: 'var(--radius-control)',
                background: 'var(--color-background-tertiary)', border: '1px solid var(--color-border-hairline)',
                color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <RotateCcw size={16} strokeWidth={1.5} />
            </button>

            <button
              onClick={timer.status === 'running' ? pauseTimer : startTimer}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 36px', borderRadius: 'var(--radius-control)',
                backgroundColor: 'var(--color-text-primary)', color: 'var(--color-background-primary)',
                fontSize: '14px', fontWeight: 600,
              }}
            >
              {timer.status === 'running' ? (
                <>
                  <Pause size={16} strokeWidth={2} />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play size={16} strokeWidth={2} />
                  <span>Start</span>
                </>
              )}
            </button>

            <button
              onClick={skipTimer} title="Skip to next"
              style={{
                width: '40px', height: '40px', borderRadius: 'var(--radius-control)',
                background: 'var(--color-background-tertiary)', border: '1px solid var(--color-border-hairline)',
                color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <SkipForward size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Right Column: Task List Card */}
        <div>
          <TaskList />
        </div>
      </div>
    </div>
  );
};
