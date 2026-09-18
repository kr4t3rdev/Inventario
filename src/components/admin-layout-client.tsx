'use client'

import { ReactNode } from "react"

/**
 * @description Wrapper cliente del layout admin.
 * Reutiliza el AuthProvider ya montado en RootLayout para no resetear
 * el snapshot autenticado durante la navegación en /admin.
 * @param {Object} props - Props
 * @param {ReactNode} props.children - Contenido anidado
 * @returns {JSX.Element} Layout con providers
 */
export function AdminLayoutClient({ children }: { children: ReactNode }) {
  return <>{children}</>
}
