import { TenantUsersPage } from '@/features/admin/components/tenant-users-page'

/**
 * @description Página de gestión de usuarios del tenant para rol manager/admin.
 * Server Component: renderiza el componente cliente que maneja la interactividad.
 * @returns {JSX.Element} Panel de control de usuarios scoped al tenant
 */

export const metadata = {
  title: "Usuarios - FinanceMDM",
}

export default function UsersConfigPage() {
  return <TenantUsersPage />
}
