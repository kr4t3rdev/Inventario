'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

import { ManagementPageTitle } from '@/components/management-page-title';

interface SettingsPageShellProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * @description Estructura compartida para páginas del grupo Configuración.
 * @param {SettingsPageShellProps} props - Identidad, acciones y contenido de la página.
 * @returns {React.JSX.Element} Página con encabezado y contenido de entrada coherentes.
 */
export function SettingsPageShell({
  icon,
  title,
  description,
  actions,
  children,
}: SettingsPageShellProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : 0.5;
  const delay = reduceMotion ? 0 : 0.3;

  return (
    <div className="container mx-auto space-y-6 py-4">
      <motion.header
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, y: reduceMotion ? 0 : -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration }}
      >
        <ManagementPageTitle icon={icon} title={title} description={description} />
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration, delay }}
        className="space-y-6"
      >
        {children}
      </motion.div>
    </div>
  );
}
