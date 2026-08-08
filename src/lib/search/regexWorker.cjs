'use strict';

/**
 * Runs entirely inside a worker_thread so the parent can forcibly
 * `.terminate()` it on a wall-clock timeout — that's the actual ReDoS
 * defense. A catastrophic pattern can still hang a single synchronous
 * `RegExp.exec()` call for as long as it likes; nothing running on the
 * same thread as that call can interrupt it. Plain CommonJS + Node
 * built-ins only, deliberately: this file is loaded by filesystem path at
 * runtime, not through Next's bundler, so it can't use `@/` aliases or ESM.
 */

const fs = require('node:fs');
const path = require('node:path');
const { parentPort, workerData } = require('node:worker_threads');

const DISPLAY_WINDOW = 200;

function windowAroundMatch(line, matchStart, matchLength) {
  if (line.length <= DISPLAY_WINDOW * 2) {
    return { text: line, matchStart, matchLength };
  }
  const from = Math.max(0, matchStart - DISPLAY_WINDOW);
  const to = Math.min(line.length, matchStart + matchLength + DISPLAY_WINDOW);
  const prefix = from > 0 ? '…' : '';
  const suffix = to < line.length ? '…' : '';
  return {
    text: `${prefix}${line.slice(from, to)}${suffix}`,
    matchStart: matchStart - from + prefix.length,
    matchLength,
  };
}

function run() {
  const { rootDir, files, pattern, flags, maxMatches, maxFilesScanned } = workerData;

  let regex;
  try {
    regex = new RegExp(pattern, flags);
  } catch (error) {
    parentPort.postMessage({ type: 'error', message: `Invalid pattern: ${error.message}` });
    return;
  }

  const results = [];
  let filesScanned = 0;
  let truncated = false;

  for (const file of files) {
    if (filesScanned >= maxFilesScanned) {
      truncated = true;
      break;
    }
    filesScanned += 1;

    let content;
    try {
      content = fs.readFileSync(path.join(rootDir, file.path), 'utf8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      regex.lastIndex = 0;
      const match = regex.exec(line);
      if (match) {
        const windowed = windowAroundMatch(line, match.index, match[0].length || 1);
        results.push({
          path: file.path,
          language: file.language,
          lineNumber: i + 1,
          lineText: windowed.text,
          matchStart: windowed.matchStart,
          matchLength: windowed.matchLength,
        });
        if (results.length >= maxMatches) {
          parentPort.postMessage({ type: 'done', results, filesScanned, truncated: true });
          return;
        }
      }
    }
  }

  parentPort.postMessage({ type: 'done', results, filesScanned, truncated });
}

run();
