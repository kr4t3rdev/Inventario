export const dynamic = 'force-dynamic'

import { ReactNode } from 'react'

/**
 * @description Layout para rutas /busy - todas son dinámicas por naturaleza
 * @param {Object} props - Props del layout
 * @param {ReactNode} props.children - Contenido anidado
 * @returns {JSX.Element} Layout
 */
export default function BusyLayout({ children }: { children: ReactNode }) {
  return children
}
