import React from 'react';
import { Trash2, CheckCircle2, Circle, Target, Clock } from 'lucide-react';
import { TaskItem } from '../types';
import { CALENDAR_LABEL_COLORS } from '../utils/calendar-colors';

interface TaskItemRowProps {
  task: TaskItem;
  isActive: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
}

export const TaskItemRow: React.FC<TaskItemRowProps> = ({
  task,
  isActive,
  onToggle,
  onSelect,
  onDelete,
}) => {
  const labelColor = task.calendarLabel ? CALENDAR_LABEL_COLORS[task.calendarLabel] : null;
  const timeText = task.allDay
    ? 'Cả ngày'
    : task.startTime && task.endTime
      ? `${task.startTime}–${task.endTime}`
      : task.startTime || null;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderRadius: 'var(--radius-control)',
        background: 'var(--color-background-tertiary)',
        border: isActive ? '1px solid var(--color-pomodoro)' : '1px solid var(--color-border-hairline)',
        opacity: task.done ? 0.5 : 1, gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        <button
          onClick={() => onToggle(task.id)}
          style={{ color: task.done ? 'var(--color-short-break)' : 'var(--color-text-muted)', display: 'flex', flexShrink: 0 }}
        >
          {task.done ? <CheckCircle2 size={16} strokeWidth={1.5} /> : <Circle size={16} strokeWidth={1.5} />}
        </button>

        <div
          onClick={() => onSelect(isActive ? null : task.id)}
          style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
        >
          <div
            style={{
              fontSize: '13px', fontWeight: isActive ? 500 : 400,
              textDecoration: task.done ? 'line-through' : 'none',
              color: 'var(--color-text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {task.title}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
            {labelColor && task.calendarLabel ? (
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '1px 6px', borderRadius: '4px',
                  backgroundColor: `${labelColor}22`, color: labelColor, fontWeight: 500,
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: labelColor }} />
                {task.calendarLabel}
              </span>
            ) : (
              <span>{task.project}</span>
            )}
            {timeText && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--color-text-muted)' }}>
                <Clock size={11} />
                {timeText}
              </span>
            )}
            <span>·</span>
            <span className="tabular-nums">
              {task.completedPomodoros} / {task.estPomodoros} sessions
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <button
          onClick={() => onSelect(isActive ? null : task.id)}
          title={isActive ? 'Active task' : 'Set as active'}
          style={{
            color: isActive ? 'var(--color-pomodoro)' : 'var(--color-text-muted)',
            padding: '4px', display: 'flex',
          }}
        >
          <Target size={16} strokeWidth={1.5} />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          title="Delete task"
          style={{ color: 'var(--color-text-muted)', padding: '4px', display: 'flex' }}
        >
          <Trash2 size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};
