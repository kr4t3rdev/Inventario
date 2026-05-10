'use client'

import { AuthProvider } from "@/contexts/auth-context"
import { ReactNode } from "react"

/**
 * @description Client component wrapper para providers en admin layout
 * @param {Object} props - Props
 * @param {ReactNode} props.children - Contenido anidado
 * @returns {JSX.Element} Layout con providers
 */
export function AdminLayoutClient({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
