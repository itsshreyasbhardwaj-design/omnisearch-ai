import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number | undefined | null): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 5) return 'just now';
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const thresholds: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.35, 'week'],
    [12, 'month'],
  ];
  let value = seconds;
  let unit: Intl.RelativeTimeFormatUnit = 'second';
  for (const [divisor, nextUnit] of thresholds) {
    if (Math.abs(value) < divisor) break;
    value /= divisor;
    unit = nextUnit;
  }
  return formatter.format(-Math.round(value), unit);
}

/** Truncate a path from the left so the filename always stays visible. */
export function truncatePath(path: string, maxLength = 56): string {
  if (path.length <= maxLength) return path;
  const segments = path.split('/');
  const file = segments.pop() ?? path;
  let result = file;
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const candidate = `${segments[i]}/${result}`;
    if (candidate.length + 2 > maxLength) return `…/${result}`;
    result = candidate;
  }
  return result;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}
