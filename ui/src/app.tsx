import React from 'react';
import { usePomodoro } from './context/pomodoro-context';
import { HeaderBar } from './components/header-bar';
import { TimerPanel } from './components/timer-panel';
import { SummaryPanel } from './components/summary-panel';
import { SettingsPanel } from './components/settings-panel';

export const AppContent: React.FC = () => {
  const { tab, loading } = usePomodoro();

  if (loading) {
    return (
      <div className="app-wrapper" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Loading Pomodoro...</div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <HeaderBar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {tab === 'timer' && <TimerPanel />}
        {tab === 'summary' && <SummaryPanel />}
        {tab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  );
};
