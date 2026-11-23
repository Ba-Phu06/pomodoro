import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/theme.css';
import { PomodoroProvider } from './context/pomodoro-context';
import { AppContent } from './app';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <PomodoroProvider>
        <AppContent />
      </PomodoroProvider>
    </React.StrictMode>
  );
}
