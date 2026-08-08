import { describe, expect, it } from 'vitest';
import { detectLanguage } from '@/lib/ingestion/languageDetect';

describe('detectLanguage', () => {
  it('maps known extensions to a language', () => {
    expect(detectLanguage('src/index.ts')).toBe('typescript');
    expect(detectLanguage('src/App.tsx')).toBe('typescript');
    expect(detectLanguage('main.go')).toBe('go');
    expect(detectLanguage('script.py')).toBe('python');
    expect(detectLanguage('lib.rs')).toBe('rust');
  });

  it('is case-insensitive on the extension', () => {
    expect(detectLanguage('README.MD')).toBe('markdown');
  });

  it('returns null for unknown or missing extensions', () => {
    expect(detectLanguage('Dockerfile')).toBeNull();
    expect(detectLanguage('no-extension')).toBeNull();
    expect(detectLanguage('archive.xyz123')).toBeNull();
  });
});
