import React, { useEffect, useState } from 'react';
import { Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { usePomodoro } from '../context/pomodoro-context';
import { CALENDAR_LABELS, CalendarFeedConfig, CalendarLabel } from '../types';
import { CALENDAR_LABEL_COLORS } from '../utils/calendar-colors';

function buildNormalizedFeeds(feeds?: CalendarFeedConfig[]): CalendarFeedConfig[] {
  const byLabel = new Map((feeds || []).map((f) => [f.label, f]));
  return CALENDAR_LABELS.map((label) => {
    const found = byLabel.get(label);
    return found ? { ...found, label } : { label, url: '', enabled: true };
  });
}

export const CalendarSettingsCard: React.FC = () => {
  const { settings, updateSettings, calendarSync, syncingCalendar, syncError, syncCalendarTasks } = usePomodoro();
  const [draftFeeds, setDraftFeeds] = useState<CalendarFeedConfig[]>(() =>
    buildNormalizedFeeds(settings.calendarFeeds)
  );

  useEffect(() => {
    setDraftFeeds(buildNormalizedFeeds(settings.calendarFeeds));
  }, [settings.calendarFeeds]);

  const updateFeed = (label: CalendarLabel, patch: Partial<CalendarFeedConfig>) => {
    setDraftFeeds((prev) =>
      prev.map((f) => (f.label === label ? { ...f, ...patch } : f))
    );
  };

  const handleSaveAndSync = async () => {
    const cleaned = draftFeeds.map((f) => ({ ...f, url: f.url.trim() }));
    await updateSettings({ ...settings, calendarFeeds: cleaned });
    await syncCalendarTasks(false);
  };

  const lastSyncLabel = calendarSync.lastSyncedAt
    ? new Date(calendarSync.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Chưa đồng bộ';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} strokeWidth={1.5} style={{ color: 'var(--color-text-secondary)' }} />
          <h3 style={{ fontSize: '13px', fontWeight: 500 }}>Google Calendar (.ics)</h3>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Cập nhật: {lastSyncLabel}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {draftFeeds.map((feed) => {
          const err = calendarSync.errors?.[feed.label];
          const isPublicUrl = /\/public\/basic\.ics/i.test(feed.url.trim());
          return (
            <div key={feed.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={feed.enabled}
                  onChange={(e) => updateFeed(feed.label, { enabled: e.target.checked })}
                  title={`Bật/tắt lịch ${feed.label}`}
                  style={{ width: '15px', height: '15px', cursor: 'pointer', flexShrink: 0 }}
                />
                <span
                  style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: CALENDAR_LABEL_COLORS[feed.label],
                  }}
                />
                <span style={{ fontSize: '12px', fontWeight: 500, width: '116px', flexShrink: 0 }}>
                  {feed.label}
                </span>
                <input
                  type="url"
                  value={feed.url}
                  onChange={(e) => updateFeed(feed.label, { url: e.target.value })}
                  placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                  style={{ flex: 1, minWidth: 0, fontSize: '12px', padding: '6px 10px' }}
                />
              </div>
              {isPublicUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#d4b24c', paddingLeft: '24px' }}>
                  <AlertCircle size={12} style={{ flexShrink: 0 }} />
                  <span>Link /public/basic.ics chỉ chạy nếu lịch đang để Công khai. Với lịch riêng tư, hãy dùng 'Địa chỉ bí mật ở định dạng iCal' (/private-.../basic.ics).</span>
                </div>
              )}
              {err && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-pomodoro)', paddingLeft: '24px' }}>
                  <AlertCircle size={12} />
                  <span>{err}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <details style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--color-text-muted)' }}>
          Cách lấy link iCal bí mật từ Google Calendar
        </summary>
        <p style={{ marginTop: '6px', paddingLeft: '8px' }}>
          Mở Google Calendar → bấm dấu <b>⋮</b> cạnh tên lịch (Work / Read / Content Creation / Study) →
          <b> Cài đặt và chia sẻ</b> → <b>Tích hợp lịch</b> → sao chép <b>Địa chỉ bí mật ở định dạng iCal</b>.
        </p>
      </details>

      {syncError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: 'var(--color-pomodoro)',
            backgroundColor: 'rgba(217, 85, 80, 0.1)',
            border: '1px solid rgba(217, 85, 80, 0.25)',
            borderRadius: 'var(--radius-control)',
            padding: '8px 10px',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{syncError}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSaveAndSync}
          disabled={syncingCalendar}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '12px', fontWeight: 500,
            backgroundColor: 'var(--color-pomodoro)', color: '#ffffff',
            padding: '7px 14px', borderRadius: 'var(--radius-control)',
            opacity: syncingCalendar ? 0.7 : 1,
          }}
        >
          <RefreshCw size={14} className={syncingCalendar ? 'spin-icon' : ''} />
          <span>{syncingCalendar ? 'Đang đồng bộ...' : 'Lưu & Đồng bộ ngay'}</span>
        </button>
      </div>
    </div>
  );
};
