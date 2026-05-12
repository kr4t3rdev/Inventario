import { AdminUsersPageClient } from "@/features/admin/components/admin-users-page-client"
import { getAdminUsersPageData } from "@/features/admin/server/data"

export const dynamic = 'force-dynamic'

/**
 * @description Página de gestión de usuarios dentro del Admin Panel.
 * Server Component: obtiene los datos iniciales del servidor y los pasa
 * al componente cliente que maneja toda la interactividad.
 *
 * @returns {Promise<JSX.Element>} Interfaz completa para gestión de usuarios.
 */
export default async function AdminUsersPage(): Promise<React.JSX.Element> {
  const initialData = await getAdminUsersPageData()

  return <AdminUsersPageClient initialData={initialData} />
}
