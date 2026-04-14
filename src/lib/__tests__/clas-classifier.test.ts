import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  getSpecificsForSection,
  isSpecificInSection,
  parseClasClassifierMarkdown,
} from '@/lib/clas-classifier';

describe('CLAS classifier parser', () => {
  const markdownPath = join(process.cwd(), 'public', 'clasificador.md');
  const classifierMarkdown = readFileSync(markdownPath, 'utf8');
  const classifierData = parseClasClassifierMarkdown(classifierMarkdown);

  it('returns specifics only for the selected section', () => {
    const specifics = getSpecificsForSection(classifierData, '05');

    expect(specifics.length).toBeGreaterThan(0);
    expect(specifics.some((specific) => specific.id === '0000')).toBe(true);
    expect(specifics.every((specific) => specific.sectionId === '05')).toBe(true);
  });

  it('recognizes a specific inside its owning section', () => {
    expect(isSpecificInSection(classifierData, '05', '0000')).toBe(true);
  });

  it('rejects a specific when it belongs to another section', () => {
    expect(isSpecificInSection(classifierData, '06', '0000')).toBe(false);
  });
});
