import '@/app/globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { LazyMotion, domAnimation } from "framer-motion";

import { AuthProvider } from '@/contexts/auth-context';
import { getCurrentUser } from '@/lib/server-actions';
import { buildCanonicalUrl, siteConfig, siteMetadata } from '@/lib/seo/site';
import { chivoMono, inter } from './fonts';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteMetadata.description,
  keywords: [
    'sistema de inventario',
    'software de ventas',
    'contabilidad para pymes',
    'erp para pymes',
    'gestion empresarial',
    'FinanceMDM',
  ],
  alternates: {
    canonical: buildCanonicalUrl('/'),
  },
  openGraph: {
    title: siteConfig.name,
    description: siteMetadata.description ?? undefined,
    url: buildCanonicalUrl('/'),
    siteName: siteConfig.name,
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
    description: siteMetadata.description ?? undefined,
  },
  icons: siteMetadata.icons,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getCurrentUser();
  // `permissions` es un Set server-side; serializarlo a array para que cruce
  // la frontera RSC→cliente (los Set no son serializables por Flight).
  const serializedUser = initialUser
    ? {
        ...initialUser,
        permissions: initialUser.permissions ? [...initialUser.permissions] : undefined,
      }
    : null;

  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${chivoMono.variable} ${inter.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <LazyMotion features={domAnimation}>
            <AuthProvider initialUser={serializedUser as never}>
              {children}
            </AuthProvider>
          </LazyMotion>
        </ThemeProvider>
      </body>
    </html>
  );
}
