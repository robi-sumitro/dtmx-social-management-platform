const MANUAL_KEY = 'dtmx:timezone:manual';

let savedTimezone: string | null = null;

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
