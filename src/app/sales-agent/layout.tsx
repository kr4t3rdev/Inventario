import { redirect } from 'next/navigation';

import { resolveSalesAgentAccess } from '@/lib/auth/sales-agent-access';
import { getProtectedRouteIdentity } from '@/lib/auth/server-route-identity';
import { getCurrentUser } from '@/lib/server-actions/get-current-user';

import { SalesAgentShell } from './sales-agent-shell';

interface SalesAgentShellUser {
  name: string | null;
  email: string;
}

/**
 * @description Protege y aísla el namespace global del Gestor de Ventas.
 * @param {{ children: React.ReactNode }} props - Contenido del namespace.
 * @returns {Promise<React.JSX.Element>} Layout dedicado.
 */
export default async function SalesAgentLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const access = resolveSalesAgentAccess(
    await getProtectedRouteIdentity(),
    '/sales-agent/referidos',
  );
  if (!access.allowed) redirect(access.redirectTo);

  const currentUser = await getCurrentUser();
  const user: SalesAgentShellUser | null = currentUser
    ? { name: currentUser.name, email: currentUser.email }
    : null;

  return <SalesAgentShell user={user}>{children}</SalesAgentShell>;
}
