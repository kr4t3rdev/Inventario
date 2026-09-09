import { RolesManager } from '@/features/roles/components/roles-manager';

/**
 * @description Página de gestión de roles personalizados del tenant.
 * El control de acceso se revalida en servidor por cada action
 * (`config.usuarios.gestionar`); este componente es cosmético.
 * @returns {JSX.Element} Panel de roles del tenant.
 */

export const metadata = {
  title: 'Roles - FinanceMDM',
};

export default function RolesConfigPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <RolesManager />
    </div>
  );
}