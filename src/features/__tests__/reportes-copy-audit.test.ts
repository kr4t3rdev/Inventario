import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Tests de copy específicos para los componentes de Reportes.
 * Verifica español neutro, terminología consistente y ausencia de anglicismos.
 */

const REPORTES_FILES = [
  'src/features/contabilidad/components/reportes/CurrencySummaryTable.tsx',
  'src/features/contabilidad/components/reportes/FinancialStatePanel.tsx',
  'src/features/contabilidad/components/reportes/AccountingDetailsDisclosure.tsx',
  'src/features/contabilidad/components/reportes/AccountingAttentionPanel.tsx',
  'src/features/contabilidad/components/reportes/ReportFiltersToolbar.tsx',
  'src/features/contabilidad/components/reportes/AnimatedNumber.tsx',
  'src/features/contabilidad/components/movimientos-table.tsx',
  'src/features/contabilidad/components/account-transaction-history.tsx',
  'src/features/contabilidad/components/resumen-financiero.tsx',
  'src/features/contabilidad/components/resumen-financiero-utils.ts',
];

function readFileContent(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new Error(`Archivo faltante en scope de tests de copy: ${path}`);
  }
}

describe('Reportes — Copy y español neutro', () => {
  it('todos los archivos del scope existen', () => {
    const missing = REPORTES_FILES.filter(f => !existsSync(f));
    expect(missing).toEqual([]);
  });

  describe('Voseo prohibido', () => {
    const VOSO_FORMS = [
      'Seleccioná', 'Mirá', 'Creá', 'Elegí', 'Compartí', 'Ganá', 'Cobrá',
      'Registrate', 'Sos', 'Tenés', 'Querés', 'Podés', 'Probá', 'Hacé',
      'Copiá', 'Actualizá', 'Eliminá', 'Guardá', 'Cancelá', 'Buscá',
      'Filtrá', 'Ordená', 'Descargá', 'Exportá', 'Importá', 'Añadí',
    ];

    it('no contiene voseo en componentes de reportes', () => {
      const findings: string[] = [];
      for (const file of REPORTES_FILES) {
        const src = readFileContent(file);
        for (const form of VOSO_FORMS) {
          const regex = new RegExp(`\\b${form}\\b`, 'gi');
          const matches = src.match(regex);
          if (matches) {
            const short = file.split('/').pop() || file;
            findings.push(`${short}: "${form}" (${matches.length}x)`);
          }
        }
      }
      expect(findings).toEqual([]);
    });
  });

  describe('Terminología contable consistente', () => {
    it('usa "Ingresos" (no "Incomes" ni "Revenue")', () => {
      const findings: string[] = [];
      for (const file of REPORTES_FILES) {
        const src = readFileContent(file);
        const lines = src.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const isComment = /^\s*(\/\/|\/\*|\*|\{\/\*)/.test(line);
          if (isComment) continue;
          const englishTerms = /\b(Incomes?|Revenue)\b/g;
          const matches = line.match(englishTerms);
          if (matches) {
            const short = file.split('/').pop() || file;
            findings.push(`${short}:${i + 1}: ${matches.join(', ')}`);
          }
        }
      }
      expect(findings).toEqual([]);
    });

    it('usa "Egresos" (no "Expenses" ni "Outflows")', () => {
      const findings: string[] = [];
      for (const file of REPORTES_FILES) {
        const src = readFileContent(file);
        const lines = src.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const isComment = /^\s*(\/\/|\/\*|\*|\{\/\*)/.test(line);
          if (isComment) continue;
          const englishTerms = /\b(Expenses?|Outflows?)\b/g;
          const matches = line.match(englishTerms);
          if (matches) {
            const short = file.split('/').pop() || file;
            findings.push(`${short}:${i + 1}: ${matches.join(', ')}`);
          }
        }
      }
      expect(findings).toEqual([]);
    });

    it('usa "Saldo" (no "Balance" ni "Remaining")', () => {
      const findings: string[] = [];
      for (const file of REPORTES_FILES) {
        const src = readFileContent(file);
        const lines = src.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const isUI = !/^(import|export|const|type|interface|function|\/)/.test(line.trim());
          if (isUI && /\b(Balance|Remaining)\b/.test(line)) {
            const short = file.split('/').pop() || file;
            findings.push(`${short}:${i + 1}: "${line.trim().slice(0, 60)}"`);
          }
        }
      }
      expect(findings).toEqual([]);
    });

    it('usa "Pendiente" (no "Pending" en UI copy)', () => {
      const findings: string[] = [];
      for (const file of REPORTES_FILES) {
        const src = readFileContent(file);
        const lines = src.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const isUI = /(<|className|variant|title|placeholder|aria-label)/.test(line);
          if (isUI && /\bPending\b/.test(line)) {
            const short = file.split('/').pop() || file;
            findings.push(`${short}:${i + 1}`);
          }
        }
      }
      expect(findings).toEqual([]);
    });

    it('usa "Sin conversión" (no "No conversion" ni "Without conversion")', () => {
      const findings: string[] = [];
      for (const file of REPORTES_FILES) {
        const src = readFileContent(file);
        if (/\b(No conversion|Without conversion)\b/i.test(src)) {
          const short = file.split('/').pop() || file;
          findings.push(short);
        }
      }
      expect(findings).toEqual([]);
    });
  });

  describe(' Anglicismos prohibidos en UI', () => {
    it('no contiene "OK" como copy visible', () => {
      const findings: string[] = [];
      for (const file of REPORTES_FILES) {
        const src = readFileContent(file);
        const lines = src.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const isUI = /title=|placeholder=|aria-label=|>[\s\S]*</.test(line);
          if (isUI && />OK<|title="OK"|>OK\b/.test(line)) {
            const short = file.split('/').pop() || file;
            findings.push(`${short}:${i + 1}`);
          }
        }
      }
      expect(findings).toEqual([]);
    });

    it('no contiene "Dashboard" (usar "Panel" o "Resumen")', () => {
      const findings: string[] = [];
      for (const file of REPORTES_FILES) {
        const src = readFileContent(file);
        const lines = src.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const isUI = /title=|>[\s\S]*</.test(line);
          if (isUI && /Dashboard/.test(line) && !/className|import/.test(line)) {
            const short = file.split('/').pop() || file;
            findings.push(`${short}:${i + 1}: "${line.trim().slice(0, 60)}"`);
          }
        }
      }
      expect(findings).toEqual([]);
    });

    it('no contiene "Total" en inglés como label de columna', () => {
      const findings: string[] = [];
      for (const file of REPORTES_FILES) {
        const src = readFileContent(file);
        const lines = src.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const isColumnHeader = /<TableHead|<th/.test(line);
          if (isColumnHeader && /Total\b/.test(line) && !/class/.test(line)) {
            const short = file.split('/').pop() || file;
            findings.push(`${short}:${i + 1}`);
          }
        }
      }
      expect(findings).toEqual([]);
    });
  });

  describe('Capitalización', () => {
    it('labels de columna capitalizados correctamente (primera letra mayúscula)', () => {
      const findings: string[] = [];
      for (const file of REPORTES_FILES) {
        const src = readFileContent(file);
        const lines = src.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const isColumnHeader = /<TableHead[^>]*>[\s]*[A-ZÁÉÍÓÚ]/.test(line);
          if (isColumnHeader) {
            const match = line.match(/<TableHead[^>]*>\s*([A-Za-zÁÉÍÓÚáéíóú]+)/);
            if (match && match[1] === match[1].toLowerCase()) {
              const short = file.split('/').pop() || file;
              findings.push(`${short}:${i + 1}: "${match[1]}"`);
            }
          }
        }
      }
      expect(findings).toEqual([]);
    });
  });

  describe('Tildes correctas', () => {
    it('no elimina tildes gramaticales (está, será, acción)', () => {
      const missingTildes = [
        { wrong: /\besta\b(?!\s+siendo|\s+en|\s+OK)/, correct: 'está', context: 'verbo estar' },
        { wrong: /\bsera\b(?!\s+siendo)/, correct: 'será', context: 'futuro de ser' },
        { wrong: /\baccion\b/, correct: 'acción', context: 'sustantivo' },
        { wrong: /\bmonto\b.*\bde\b.*\blos\b/, correct: 'ok', context: 'preposición' },
      ];

      const findings: string[] = [];
      for (const file of REPORTES_FILES) {
        const src = readFileContent(file);
        const lines = src.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const isUI = /title=|placeholder=|aria-label=|>[A-ZÁÉÍÓÚ]/.test(line);
          if (isUI) {
            for (const { wrong, correct, context } of missingTildes) {
              if (correct !== 'ok' && wrong.test(line)) {
                const short = file.split('/').pop() || file;
                findings.push(`${short}:${i + 1}: falta tilde en "${context}"`);
              }
            }
          }
        }
      }
      expect(findings).toEqual([]);
    });
  });
});
