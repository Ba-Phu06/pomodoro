# Security Policy

## Local Data & Privacy

- All application state (`timer`, `tasks`, `settings`, `sessions`, `calendarFeeds`) is stored locally on your machine in `${PLUGIN_DATA}/pomodoro-data.json`.
- On POSIX systems, `pomodoro-data.json` is written with `0600` permissions (owner read/write only) to protect secret Google Calendar iCal URLs.
- No analytics, telemetry, or external tracking services are used.

## Network & SSRF Protections

When syncing Google Calendar `.ics` feeds (`server/calendar-sync.ts`):

- **HTTPS Only**: Production sync requires `https://` URLs (local `http://127.0.0.1` is only permitted when `POMODORO_ALLOW_LOCAL_ICS=1` is explicitly set for automated tests).
- **SSRF Blocking**: Requests to `localhost`, `*.local`, `*.internal`, loopback (`127.0.0.0/8`, `::1`), link-local/cloud metadata (`169.254.0.0/16`, `fe80::/10`), and private RFC 1918/RFC 4193 IP ranges are rejected both before fetching and after redirects.
- **Payload Cap**: `.ics` responses are capped at **5 MB** (`5 * 1024 * 1024` bytes) with a 10-second request timeout.
- **Token Redaction**: Any `/private-...` token segment in a caught network error is redacted as `/private-[REDACTED]`.

## Reporting a Vulnerability

If you discover a security issue in this plugin, please open a private security advisory on GitHub rather than posting exploit details publicly.
