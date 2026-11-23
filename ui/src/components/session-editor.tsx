import React, { useState } from 'react';
import { X, Plus, Trash2, Clock, Calendar } from 'lucide-react';
import { usePomodoro } from '../context/pomodoro-context';
import { formatDateShort, formatTimeOfDay } from '../utils/format';

interface SessionEditorProps {
  onClose: () => void;
}

export const SessionEditor: React.FC<SessionEditorProps> = ({ onClose }) => {
  const { summary, deleteSession, addManualSession } = usePomodoro();
  const [isAdding, setIsAdding] = useState(false);
  const [duration, setDuration] = useState(25);
  const [project, setProject] = useState('General');
  const [taskTitle, setTaskTitle] = useState('');

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    await addManualSession(duration, project, taskTitle);
    setIsAdding(false);
    setTaskTitle('');
    setDuration(25);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 500 }}>Focus sessions</h3>
          <button onClick={onClose} style={{ color: 'var(--color-text-secondary)', padding: '4px' }}>
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', color: 'var(--color-pomodoro)',
              marginBottom: '16px', fontWeight: 500,
            }}
          >
            <Plus size={16} strokeWidth={1.5} />
            <span>Add manual session</span>
          </button>
        ) : (
          <form
            onSubmit={handleAddManual}
            style={{
              marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px',
              background: 'var(--color-background-tertiary)', padding: '12px',
              borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-hairline)',
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Minutes:</span>
                <input
                  type="number" min={1} max={240} value={duration}
                  onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>
              <div style={{ flex: 2 }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Project:</span>
                <input
                  type="text" value={project} onChange={(e) => setProject(e.target.value)}
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Note / task (optional):</span>
              <input
                type="text" placeholder="What did you work on?"
                value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button" onClick={() => setIsAdding(false)}
                style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '6px 12px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  fontSize: '12px', fontWeight: 500, background: 'var(--color-pomodoro)',
                  color: '#ffffff', padding: '6px 16px', borderRadius: 'var(--radius-control)',
                }}
              >
                Add session
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
          {summary.recentSessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontSize: '12px' }}>
              No recorded sessions yet
            </div>
          ) : (
            summary.recentSessions.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', background: 'var(--color-background-tertiary)',
                  borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-hairline)',
                  fontSize: '12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {s.taskTitle || s.project || 'Focus session'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} strokeWidth={1.5} /> {formatDateShort(s.completedAt)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} strokeWidth={1.5} /> {formatTimeOfDay(s.completedAt)}
                    </span>
                    <span className="tabular-nums">· {s.durationMinutes} min</span>
                  </div>
                </div>

                <button
                  onClick={() => deleteSession(s.id)} title="Delete session"
                  style={{ color: 'var(--color-text-muted)', padding: '4px', display: 'flex' }}
                >
                  <Trash2 size={16} strokeWidth={1.5} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
