'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

import { ManagementPageTitle } from '@/components/management-page-title';

interface AccountingPageShellProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * @description Estructura visual compartida para las páginas del módulo de Contabilidad.
 * @param {AccountingPageShellProps} props - Identidad, acciones y contenido de la página.
 * @returns {React.JSX.Element} Página contable con encabezado y entrada de contenido coherentes.
 */
export function AccountingPageShell({
  icon,
  title,
  description,
  actions,
  children,
}: AccountingPageShellProps): React.JSX.Element {
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
