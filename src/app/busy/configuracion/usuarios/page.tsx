import { TenantUsersPage } from '@/features/admin/components/tenant-users-page'

/**
 * @description Página de gestión de usuarios del tenant para rol manager/admin.
 * Server Component: renderiza el componente cliente que maneja la interactividad.
 * @returns {JSX.Element} Panel de control de usuarios scoped al tenant
 */

export const metadata = {
  title: "Usuarios - FinanceTCP",
}

export default function UsersConfigPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <TenantUsersPage />
    </div>
  )
}
