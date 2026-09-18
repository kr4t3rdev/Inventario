/**
 * @description CLAS classifier data and parsing utilities for EAN-13 mode.
 * The official source of truth is the markdown table in /public/clasificador.md.
 */

import { CATEGORY_TO_SECTION, SUBCATEGORY_TO_SPECIFIC } from './category-mapping';

export interface CLASSection {
  id: string;
  name: string;
}

export interface CLASSpecific {
  id: string;
  name: string;
  sectionId: string;
}

export interface CLASClassifierRow {
  sectionId: string;
  sectionName: string;
  specificId: string;
  specificName: string;
}

export interface CLASClassifierData {
  rows: CLASClassifierRow[];
  sections: CLASSection[];
  specifics: CLASSpecific[];
  specificsBySection: Record<string, CLASSpecific[]>;
  sectionNameById: Record<string, string>;
  sectionIdByName: Record<string, string>;
  specificNameById: Record<string, string>;
  specificIdByName: Record<string, string>;
  specificSectionById: Record<string, string>;
}

const CLASSIFIER_ROW_PATTERN = /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|$/;

const normalizeSectionId = (sectionId: string) => sectionId.trim().padStart(2, '0');
const normalizeSpecificId = (specificId: string) => specificId.trim().padStart(4, '0');

export const CLAS_SECTIONS: CLASSection[] = Object.entries(CATEGORY_TO_SECTION).map(
  ([name, id]) => ({
    id,
    name,
  })
);

export const CLAS_SPECIFICS: CLASSpecific[] = Object.entries(SUBCATEGORY_TO_SPECIFIC).map(
  ([name, id]) => ({
    id,
    name,
    sectionId: '',
  })
);

export function parseClasClassifierMarkdown(markdown: string): CLASClassifierData {
  const rows: CLASClassifierRow[] = [];

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line.startsWith('|')) {
      continue;
    }

    const match = CLASSIFIER_ROW_PATTERN.exec(line);
    if (!match) {
      continue;
    }

    const sectionId = normalizeSectionId(match[1]);
    const sectionName = match[2].trim();
    const specificId = normalizeSpecificId(match[3]);
    const specificName = match[4].trim();

    rows.push({
      sectionId,
      sectionName,
      specificId,
      specificName,
    });
  }

  return buildClasClassifierData(rows);
}

export function buildClasClassifierData(rows: CLASClassifierRow[]): CLASClassifierData {
  const sectionMap = new Map<string, CLASSection>();
  const specificsBySection: Record<string, CLASSpecific[]> = {};
  const sectionNameById: Record<string, string> = {};
  const sectionIdByName: Record<string, string> = {};
  const specificNameById: Record<string, string> = {};
  const specificIdByName: Record<string, string> = {};
  const specificSectionById: Record<string, string> = {};
  const specifics: CLASSpecific[] = [];

  for (const row of rows) {
    if (!sectionMap.has(row.sectionId)) {
      sectionMap.set(row.sectionId, {
        id: row.sectionId,
        name: row.sectionName,
      });
      sectionNameById[row.sectionId] = row.sectionName;
      sectionIdByName[row.sectionName.trim().toUpperCase()] = row.sectionId;
    }

    const specific: CLASSpecific = {
      id: row.specificId,
      name: row.specificName,
      sectionId: row.sectionId,
    };

    specifics.push(specific);
    specificNameById[row.specificId] = row.specificName;
    specificIdByName[row.specificName.trim().toUpperCase()] = row.specificId;
    specificSectionById[row.specificId] = row.sectionId;

    if (!specificsBySection[row.sectionId]) {
      specificsBySection[row.sectionId] = [];
    }

    specificsBySection[row.sectionId].push(specific);
  }

  return {
    rows,
    sections: Array.from(sectionMap.values()),
    specifics,
    specificsBySection,
    sectionNameById,
    sectionIdByName,
    specificNameById,
    specificIdByName,
    specificSectionById,
  };
}

export function getSpecificsForSection(
  classifier: CLASClassifierData,
  sectionId: string
): CLASSpecific[] {
  return classifier.specificsBySection[normalizeSectionId(sectionId)] ?? [];
}

export function getSectionForSpecific(
  classifier: CLASClassifierData,
  specificId: string
): string | null {
  return classifier.specificSectionById[normalizeSpecificId(specificId)] ?? null;
}

export function isSpecificInSection(
  classifier: CLASClassifierData,
  sectionId: string,
  specificId: string
): boolean {
  return getSectionForSpecific(classifier, specificId) === normalizeSectionId(sectionId);
}

export function validateCLASSection(name: string): string | null {
  const normalized = name.trim().toUpperCase();
  const match = Object.keys(CATEGORY_TO_SECTION).find(
    key => key.trim().toUpperCase() === normalized
  );

  return match ? CATEGORY_TO_SECTION[match as keyof typeof CATEGORY_TO_SECTION] : null;
}

export function validateCLASSpecific(name: string): string | null {
  const normalized = name.trim().toUpperCase();
  const match = Object.keys(SUBCATEGORY_TO_SPECIFIC).find(
    key => key.trim().toUpperCase() === normalized
  );

  return match ? SUBCATEGORY_TO_SPECIFIC[match as keyof typeof SUBCATEGORY_TO_SPECIFIC] : null;
}
