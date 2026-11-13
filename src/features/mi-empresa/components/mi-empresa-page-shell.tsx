'use client';

import type { ReactNode } from 'react';
import { Building2 } from 'lucide-react';

import { SettingsPageShell } from '@/features/configuracion/components/settings-page-shell';

/**
 * @description Presenta la configuración de la empresa con su icono en el cliente.
 * @param {{ children: ReactNode }} props - Contenido de la configuración.
 * @returns {React.JSX.Element} Página de configuración de la empresa.
 */
export function MiEmpresaPageShell({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <SettingsPageShell
      icon={Building2}
      title="Mi Empresa"
      description="Configura los datos que aparecen como beneficiario en facturas y documentos."
    >
      {children}
    </SettingsPageShell>
  );
}
