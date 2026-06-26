import '@/app/globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { LazyMotion, domAnimation } from "framer-motion";

import { AuthProvider } from '@/contexts/auth-context';
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
    description: siteMetadata.description,
    url: buildCanonicalUrl('/'),
    siteName: siteConfig.name,
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
    description: siteMetadata.description,
  },
  icons: siteMetadata.icons,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${chivoMono.variable} ${inter.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <LazyMotion features={domAnimation}>
            <AuthProvider>
              {children}
            </AuthProvider>
          </LazyMotion>
        </ThemeProvider>
      </body>
    </html>
  );
}
