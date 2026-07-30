import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}

describe('user-facing error safety', () => {
  it('does not render caught exception messages directly in client modules', () => {
    const files = [
      ...sourceFiles(join(ROOT, 'src/app')),
      ...sourceFiles(join(ROOT, 'src/components')),
      ...sourceFiles(join(ROOT, 'src/hooks')),
    ];

    const unsafePatterns = [
      /description:\s*(?:error|err)\.message/,
      /description:\s*(?:error|err)\s+instanceof\s+Error\s*\?\s*(?:error|err)\.message/,
      /set[A-Za-z]*Error\(\s*(?:error|err)\.message/,
      /set[A-Za-z]*Error\(\s*(?:data|result|payload)\.(?:error|message)/,
    ];

    const violations = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      if (!/^['"]use client['"];/.test(source)) return [];
      return unsafePatterns.some((pattern) => pattern.test(source))
        ? [relative(ROOT, file)]
        : [];
    });

    expect(violations).toEqual([]);
  });

  it('keeps every public and route-level fallback free of raw error output', () => {
    const boundaries = [
      'src/app/error.tsx',
      'src/app/global-error.tsx',
      'src/app/(app)/error.tsx',
      'src/app/(wizard)/error.tsx',
      'src/components/route-error-fallback.tsx',
    ];

    for (const boundary of boundaries) {
      const source = readFileSync(join(ROOT, boundary), 'utf8');
      expect(source, boundary).not.toMatch(/\{\s*error\.(?:message|digest|stack)\s*\}/);
    }
  });

  it('does not return exception messages directly from API routes', () => {
    const apiFiles = sourceFiles(join(ROOT, 'src/app/api'));
    const violations = apiFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return /NextResponse\.json\(\s*\{\s*error:\s*(?:error|err)\.message/.test(source)
        ? [relative(ROOT, file)]
        : [];
    });

    expect(violations).toEqual([]);
  });
});
