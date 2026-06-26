import type { Metadata } from 'next';

const DEFAULT_SITE_URL = 'http://localhost:3000';

export const PUBLIC_ROUTE_PATHS = ['/', '/docs'] as const;
export const PRIVATE_ROUTE_PREFIXES = ['/busy', '/admin', '/api'] as const;

export interface FaqEntry {
  question: string;
  answer: string;
}

interface SchemaBase {
  '@context': 'https://schema.org';
  '@type': string;
}

interface OrganizationSchema extends SchemaBase {
  '@type': 'Organization';
  name: string;
  url: string;
  description: string;
}

interface SoftwareApplicationSchema extends SchemaBase {
  '@type': 'SoftwareApplication';
  name: string;
  url: string;
  description: string;
  applicationCategory: 'BusinessApplication';
  operatingSystem: 'Web';
}

interface AnswerSchema {
  '@type': 'Answer';
  text: string;
}

interface QuestionSchema {
  '@type': 'Question';
  name: string;
  acceptedAnswer: AnswerSchema;
}

interface FaqSchema extends SchemaBase {
  '@type': 'FAQPage';
  mainEntity: QuestionSchema[];
}

export const siteConfig = {
  name: 'FinanceMDM',
  url: normalizeSiteUrl(process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_SITE_URL),
  defaultDescription:
    'FinanceMDM es un sistema de gestion empresarial para centralizar inventario, ventas, contabilidad, compras y operaciones de pymes en una sola plataforma.',
} as const;

export const siteMetadata: Pick<Metadata, 'title' | 'description' | 'icons'> = {
  title: siteConfig.name,
  description: siteConfig.defaultDescription,
  icons: {
    icon: '/icon.svg',
  },
};

export function buildPublicPageUrls(paths: readonly string[]): string[] {
  return paths.map((path) => buildCanonicalUrl(path));
}

export function buildCanonicalUrl(path = '/'): string {
  if (path === '/') {
    return siteConfig.url;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return new URL(normalizedPath, `${siteConfig.url}/`).toString().replace(/\/$/, '');
}

export function buildOrganizationSchema(): OrganizationSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.defaultDescription,
  };
}

export function buildSoftwareApplicationSchema(): SoftwareApplicationSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.defaultDescription,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
  };
}

export function buildFaqSchema(entries: FaqEntry[]): FaqSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };
}

function normalizeSiteUrl(url: string): string {
  return url.replace(/\/$/, '');
}
