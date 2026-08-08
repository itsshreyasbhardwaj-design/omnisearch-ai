import { describe, expect, it } from 'vitest';
import { escapeHtml, highlightSpan, markersToHtml } from '@/lib/search/highlight';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<script>alert('x')</script> & "quote"`)).toBe(
      '&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; &quot;quote&quot;',
    );
  });
});

describe('markersToHtml', () => {
  it('wraps marked spans in <mark> and escapes the rest', () => {
    const raw = 'const \u0001auth\u0002Service = 1;';
    expect(markersToHtml(raw, '\u0001', '\u0002')).toBe('const <mark>auth</mark>Service = 1;');
  });

  it('escapes HTML in both the marked and unmarked text', () => {
    const raw = '<div>\u0001<b>x</b>\u0002</div>';
    expect(markersToHtml(raw, '\u0001', '\u0002')).toBe(
      '&lt;div&gt;<mark>&lt;b&gt;x&lt;/b&gt;</mark>&lt;/div&gt;',
    );
  });

  it('handles text with no markers at all', () => {
    expect(markersToHtml('plain text', '\u0001', '\u0002')).toBe('plain text');
  });

  it('supports multiple marked spans', () => {
    const raw = '\u0001a\u0002 middle \u0001b\u0002';
    expect(markersToHtml(raw, '\u0001', '\u0002')).toBe('<mark>a</mark> middle <mark>b</mark>');
  });
});

describe('highlightSpan', () => {
  it('wraps the given span in <mark> and escapes the rest', () => {
    expect(highlightSpan('hello world', 6, 5)).toBe('hello <mark>world</mark>');
  });

  it('escapes HTML characters outside and inside the match', () => {
    expect(highlightSpan('<a>TODO</a>', 3, 4)).toBe('&lt;a&gt;<mark>TODO</mark>&lt;/a&gt;');
  });
});
