import { JsonLd } from '@/components/seo/json-ld';
import { LandingPageClient } from '@/features/landing/components/landing-page-client';
import { FAQ_ITEMS } from '@/features/landing/data';
import {
  buildFaqSchema,
  buildOrganizationSchema,
  buildSoftwareApplicationSchema,
} from '@/lib/seo/site';

/**
 * @description Página principal del producto con narrativa visual animada
 *              y enfoque Bungee-inspired (dark industrial + animaciones spring).
 *              Server component que delega el renderizado interactivo al cliente.
 * @returns {JSX.Element} Landing page con spring animations y tipografía Chivo Mono.
 */
export default function Home(): React.JSX.Element {
  return (
    <>
      <JsonLd data={buildOrganizationSchema()} />
      <JsonLd data={buildSoftwareApplicationSchema()} />
      <JsonLd data={buildFaqSchema(FAQ_ITEMS)} />
      <LandingPageClient />
    </>
  );
}
