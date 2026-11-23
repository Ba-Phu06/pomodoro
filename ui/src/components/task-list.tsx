import React, { useState } from 'react';
import { Plus, RefreshCw, Calendar, AlertCircle } from 'lucide-react';
import { usePomodoro } from '../context/pomodoro-context';
import { CALENDAR_LABELS, CalendarLabel } from '../types';
import { CALENDAR_LABEL_COLORS } from '../utils/calendar-colors';
import { TaskItemRow } from './task-item-row';

type FilterOption = 'All' | CalendarLabel;

export const TaskList: React.FC = () => {
  const {
    tasks, timer, settings, syncingCalendar, syncError,
    addTask, toggleTask, deleteTask, selectActiveTask, syncCalendarTasks, setTab,
  } = usePomodoro();
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('');
  const [est, setEst] = useState(1);
  const [filter, setFilter] = useState<FilterOption>('All');

  const hasConfiguredFeeds = (settings.calendarFeeds || []).some((f) => f.enabled && f.url.trim());
  const hasCalendarTasks = tasks.some((t) => t.source === 'gcalendar');
  const visibleTasks = filter === 'All'
    ? tasks
    : tasks.filter((t) => t.calendarLabel === filter || t.project === filter);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await addTask(title.trim(), project.trim(), est);
    setTitle('');
    setProject('');
    setEst(1);
    setIsAdding(false);
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Tasks</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {hasConfiguredFeeds && (
            <button
              onClick={() => syncCalendarTasks(false)}
              disabled={syncingCalendar}
              title="Đồng bộ Google Calendar"
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '12px', color: 'var(--color-text-secondary)',
                opacity: syncingCalendar ? 0.6 : 1,
              }}
            >
              <RefreshCw size={14} className={syncingCalendar ? 'spin-icon' : ''} />
              <span>Đồng bộ</span>
            </button>
          )}
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '12px', color: 'var(--color-pomodoro)', fontWeight: 500,
              }}
            >
              <Plus size={16} strokeWidth={1.5} />
              <span>Add task</span>
            </button>
          )}
        </div>
      </div>

      {(hasConfiguredFeeds || hasCalendarTasks) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {(['All', ...CALENDAR_LABELS] as FilterOption[]).map((opt) => {
            const active = filter === opt;
            const color = opt === 'All' ? 'var(--color-pomodoro)' : CALENDAR_LABEL_COLORS[opt];
            return (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                style={{
                  fontSize: '11px', padding: '3px 9px', borderRadius: '999px',
                  border: active ? `1px solid ${color}` : '1px solid var(--color-border-hairline)',
                  background: active ? `${color}22` : 'var(--color-background-tertiary)',
                  color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {!hasConfiguredFeeds && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
            padding: '8px 10px', borderRadius: 'var(--radius-control)',
            background: 'var(--color-background-tertiary)', border: '1px solid var(--color-border-hairline)',
            fontSize: '11px', color: 'var(--color-text-secondary)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} />
            Chưa kết nối lịch Work / Read / Content Creation / Study
          </span>
          <button
            onClick={() => setTab('settings')}
            style={{ fontSize: '11px', color: 'var(--color-pomodoro)', fontWeight: 500, flexShrink: 0 }}
          >
            Cài đặt
          </button>
        </div>
      )}

      {syncError && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
            padding: '8px 10px', borderRadius: 'var(--radius-control)',
            background: 'var(--color-pomodoro-subtle)', color: 'var(--color-pomodoro)', fontSize: '11px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={14} />
            {syncError}
          </span>
          <button onClick={() => syncCalendarTasks(false)} style={{ fontSize: '11px', fontWeight: 500, textDecoration: 'underline' }}>
            Thử lại
          </button>
        </div>
      )}

      {isAdding && (
        <form
          onSubmit={handleCreate}
          style={{
            display: 'flex', flexDirection: 'column', gap: '8px',
            background: 'var(--color-background-tertiary)', padding: '12px',
            borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-hairline)',
          }}
        >
          <input
            type="text" placeholder="What are you working on?"
            value={title} onChange={(e) => setTitle(e.target.value)}
            autoFocus required
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text" placeholder="Project tag (optional)"
              value={project} onChange={(e) => setProject(e.target.value)}
              style={{ flex: 1 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Est:</span>
              <input
                type="number" min={1} max={20} value={est}
                onChange={(e) => setEst(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: '48px', textAlign: 'center' }}
              />
            </div>
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
                fontSize: '12px', fontWeight: 500, backgroundColor: 'var(--color-pomodoro)',
                color: '#ffffff', padding: '6px 16px', borderRadius: 'var(--radius-control)',
              }}
            >
              Save
            </button>
          </div>
        </form>
      )}

      {visibleTasks.length === 0 && !isAdding ? (
        <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--color-text-muted)', fontSize: '12px' }}>
          {syncingCalendar ? 'Đang tải công việc hôm nay...' : 'No tasks yet'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {visibleTasks.map((task) => (
            <TaskItemRow
              key={task.id}
              task={task}
              isActive={timer.activeTaskId === task.id}
              onToggle={toggleTask}
              onSelect={selectActiveTask}
              onDelete={deleteTask}
            />
          ))}
        </div>
      )}
    </div>
  );
};
