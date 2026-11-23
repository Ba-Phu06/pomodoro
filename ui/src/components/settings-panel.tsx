import React from 'react';
import { Volume2, Sliders, BellRing } from 'lucide-react';
import { usePomodoro } from '../context/pomodoro-context';
import { BellSound, PomodoroSettings } from '../types';
import { playBell } from '../utils/audio';
import { callAppTool, mcpBridge } from '../utils/mcp-client';
import { CalendarSettingsCard } from './calendar-settings-card';

export const SettingsPanel: React.FC = () => {
  const { settings, updateSettings, applyPreset } = usePomodoro();

  const handleChange = (key: keyof PomodoroSettings, value: unknown) => {
    updateSettings({ ...settings, [key]: value });
  };

  const handleTestSound = () => {
    playBell(settings.sound, settings.volume);
  };

  const handleTestNotification = () => {
    if (mcpBridge.isConnected()) {
      callAppTool('pomodoro_test_notification', {}).catch(() => {});
    } else {
      playBell(settings.sound, settings.volume);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Timer Durations Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={16} strokeWidth={1.5} style={{ color: 'var(--color-text-secondary)' }} />
          <h3 style={{ fontSize: '13px', fontWeight: 500 }}>Timer durations (minutes)</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Pomodoro</span>
            <input
              type="number" min={1} max={120} value={settings.pomodoroMin}
              onChange={(e) => handleChange('pomodoroMin', Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Short break</span>
            <input
              type="number" min={1} max={60} value={settings.shortBreakMin}
              onChange={(e) => handleChange('shortBreakMin', Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Long break</span>
            <input
              type="number" min={1} max={90} value={settings.longBreakMin}
              onChange={(e) => handleChange('longBreakMin', Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
          <span style={{ fontSize: '13px' }}>Long break interval</span>
          <input
            type="number" min={1} max={12} value={settings.longBreakInterval}
            onChange={(e) => handleChange('longBreakInterval', Math.max(1, parseInt(e.target.value) || 1))}
            style={{ width: '56px', textAlign: 'center' }}
          />
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--color-border-hairline)' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Presets:</span>
          <button
            onClick={() => applyPreset(25, 5)}
            style={{
              fontSize: '11px', padding: '4px 12px', borderRadius: 'var(--radius-control)',
              background: 'var(--color-background-tertiary)', border: '1px solid var(--color-border-hairline)',
            }}
          >
            Standard (25 / 5 min)
          </button>
          <button
            onClick={() => applyPreset(40, 5)}
            style={{
              fontSize: '11px', padding: '4px 12px', borderRadius: 'var(--radius-control)',
              background: 'var(--color-background-tertiary)', border: '1px solid var(--color-border-hairline)',
            }}
          >
            Deep focus (40 / 5 min)
          </button>
        </div>
      </div>

      {/* Automation Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 500 }}>Automation</h3>

        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <span style={{ fontSize: '13px' }}>Auto-start breaks</span>
          <input
            type="checkbox" checked={settings.autoStartBreaks}
            onChange={(e) => handleChange('autoStartBreaks', e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <span style={{ fontSize: '13px' }}>Auto-start pomodoros</span>
          <input
            type="checkbox" checked={settings.autoStartPomodoros}
            onChange={(e) => handleChange('autoStartPomodoros', e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
        </label>
      </div>

      {/* Sound & Notification Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BellRing size={16} strokeWidth={1.5} style={{ color: 'var(--color-text-secondary)' }} />
          <h3 style={{ fontSize: '13px', fontWeight: 500 }}>Alarm sound</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px' }}>Sound effect</span>
          <select
            value={settings.sound}
            onChange={(e) => handleChange('sound', e.target.value as BellSound)}
            style={{ width: '140px' }}
          >
            <option value="bell">Desk bell</option>
            <option value="chime">Ascending chime</option>
            <option value="beep">Digital beep</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <Volume2 size={16} strokeWidth={1.5} style={{ color: 'var(--color-text-secondary)' }} />
            <span>Volume ({Math.round(settings.volume * 100)}%)</span>
          </div>
          <input
            type="range" min="0" max="1" step="0.05" value={settings.volume}
            onChange={(e) => handleChange('volume', parseFloat(e.target.value))}
            style={{ width: '130px', cursor: 'pointer' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleTestSound}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '12px', padding: '6px 14px', background: 'var(--color-background-tertiary)',
              borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-hairline)',
            }}
          >
            <Volume2 size={16} strokeWidth={1.5} />
            <span>Test sound</span>
          </button>

          <button
            onClick={handleTestNotification}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '12px', padding: '6px 14px', background: 'var(--color-background-tertiary)',
              borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-hairline)',
            }}
          >
            <BellRing size={16} strokeWidth={1.5} />
            <span>Test thông báo</span>
          </button>
        </div>
      </div>

      <CalendarSettingsCard />
    </div>
  );
};
