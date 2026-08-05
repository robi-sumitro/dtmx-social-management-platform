const MANUAL_KEY = 'dtmx:timezone:manual';

let savedTimezone: string | null = null;

// Offset in ms between the server clock and the device clock (serverNow - deviceNow).
// Used so relative times ("x mnt lalu") match the server's clock instead of the device's.
let serverClockOffset = 0;

export function setServerClockOffset(offsetMs: number): void {
  if (Number.isFinite(offsetMs)) serverClockOffset = offsetMs;
}

export function getServerNow(): Date {
  return new Date(Date.now() + serverClockOffset);
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isValidTimezone(tz?: string | null): tz is string {
  if (!tz || !tz.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function setActiveTimezone(tz?: string | null): void {
  savedTimezone = isValidTimezone(tz) ? tz.trim() : null;
}

export function getActiveTimezone(): string {
  return savedTimezone ?? getManualTimezone() ?? detectTimezone();
}

export function getManualTimezone(): string | null {
  try {
    const tz = localStorage.getItem(MANUAL_KEY);
    return isValidTimezone(tz) ? tz : null;
  } catch {
    return null;
  }
}

export function setManualTimezone(tz: string | null): void {
  try {
    if (isValidTimezone(tz)) {
      localStorage.setItem(MANUAL_KEY, tz as string);
    } else {
      localStorage.removeItem(MANUAL_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function isTimezoneAuto(): boolean {
  return !getManualTimezone();
}

/**
 * Convert a Date into the value expected by an `<input type="datetime-local">`
 * rendered in the active timezone (year-month-dayThh:mm).
 */
export function toLocalInputValue(date?: string | Date | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: getActiveTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${pad(Number(get('hour'))) || get('hour')}:${get('minute')}`;
}

/**
 * Parse the value of an `<input type="datetime-local">` (a wall-clock time in the
 * active timezone) back into a UTC Date without relying on the device timezone.
 */
export function fromLocalInputValue(value: string): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const timeZone = getActiveTimezone();
  // The wall-clock time the user typed, treated as if it were UTC (a starting guess).
  const target = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0));
  if (Number.isNaN(target)) return null;

  // Render an instant as a Date.UTC() of its wall-clock fields in the active zone.
  const render = (utcMs: number): number => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utcMs));
    const gp = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    return Date.UTC(gp('year'), gp('month') - 1, gp('day'), gp('hour'), gp('minute'), gp('second'));
  };

  // Fixed-point iteration: find the UTC instant whose rendered wall-clock equals
  // the typed value. best_{n+1} = target - (render(best_n) - best_n). The sign is
  // crucial: adding the offset (as a naive conversion does) shifts times by 2x the
  // UTC offset (e.g. a 09:45 WIB pick would be stored as 16:45Z and re-displayed 23:45).
  let best = target;
  for (let i = 0; i < 3; i++) {
    const rendered = render(best);
    if (Number.isNaN(rendered)) break;
    const next = target - (rendered - best);
    if (next === best) break;
    best = next;
  }
  return new Date(best);
}

export const TIMEZONE_OPTIONS: string[] = [
  'Asia/Jakarta',
  'Asia/Pontianak',
  'Asia/Makassar',
  'Asia/Jayapura',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Bangkok',
  'Asia/Manila',
  'Asia/Ho_Chi_Minh',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Tehran',
  'Asia/Baghdad',
  'Asia/Yerevan',
  'Asia/Tbilisi',
  'Asia/Almaty',
  'Asia/Tashkent',
  'Asia/Ulaanbaatar',
  'UTC',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Europe/Kyiv',
  'Europe/Warsaw',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Athens',
  'Europe/London',
  'Europe/Lisbon',
  'Africa/Cairo',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Caracas',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Santiago',
  'America/Halifax',
  'America/St_Johns',
  'Pacific/Honolulu',
  'Pacific/Auckland',
  'Pacific/Guam',
  'Pacific/Port_Moresby',
  'Pacific/Fiji',
  'Pacific/Chatham',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Adelaide',
  'Australia/Perth',
  'Australia/Darwin',
];
