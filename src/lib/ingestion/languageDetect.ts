/**
 * Extension → language table. Deliberately just a lookup for phase 1-2 —
 * AST-aware parsing (phase 3) will introduce a `LanguageParser` per entry
 * here without touching search/indexing code, since callers only depend on
 * the `language` string this module returns.
 */
export const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  pyi: 'python',
  java: 'java',
  go: 'go',
  rs: 'rust',
  cs: 'csharp',
  php: 'php',
  rb: 'ruby',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  json: 'json',
  toml: 'toml',
  html: 'html',
  css: 'css',
  scss: 'scss',
  md: 'markdown',
  mdx: 'markdown',
  vue: 'vue',
  svelte: 'svelte',
  graphql: 'graphql',
  proto: 'protobuf',
};

export function detectLanguage(filePath: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(filePath);
  if (!match) return null;
  const ext = match[1]?.toLowerCase();
  if (!ext) return null;
  return LANGUAGE_BY_EXTENSION[ext] ?? null;
}
