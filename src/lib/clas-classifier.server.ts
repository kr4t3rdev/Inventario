import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildClasClassifierData, parseClasClassifierMarkdown, CLASClassifierData } from '@/lib/clas-classifier';

let cachedClassifierData: CLASClassifierData | null = null;

export function getClasClassifierData(): CLASClassifierData {
  if (!cachedClassifierData) {
    const markdownPath = join(process.cwd(), 'public', 'clasificador.md');
    const markdown = readFileSync(markdownPath, 'utf8');
    cachedClassifierData = buildClasClassifierData(
      parseClasClassifierMarkdown(markdown).rows
    );
  }

  return cachedClassifierData;
}
