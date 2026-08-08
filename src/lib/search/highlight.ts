/**
 * Search results render snippets pulled from the user's own source code as
 * HTML (to show a `<mark>` around the match). That text must be escaped
 * before it's ever treated as HTML — these are the only two places that
 * happens, and every renderer of a snippet goes through one of them.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Converts a snippet containing raw start/end markers into escaped HTML with <mark> spans. */
export function markersToHtml(raw: string, startMarker: string, endMarker: string): string {
  let result = '';
  let cursor = 0;

  while (cursor < raw.length) {
    const start = raw.indexOf(startMarker, cursor);
    if (start === -1) {
      result += escapeHtml(raw.slice(cursor));
      break;
    }
    result += escapeHtml(raw.slice(cursor, start));

    const end = raw.indexOf(endMarker, start + startMarker.length);
    if (end === -1) {
      result += escapeHtml(raw.slice(start + startMarker.length));
      break;
    }
    result += `<mark>${escapeHtml(raw.slice(start + startMarker.length, end))}</mark>`;
    cursor = end + endMarker.length;
  }

  return result;
}

/** Wraps `line[start, start+length)` in `<mark>`, HTML-escaping the rest. */
export function highlightSpan(line: string, start: number, length: number): string {
  const before = line.slice(0, start);
  const match = line.slice(start, start + length);
  const after = line.slice(start + length);
  return `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
}
