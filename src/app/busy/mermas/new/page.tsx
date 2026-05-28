/**
 * @description Página de nueva Merma (Server Component).
 *
 * Delega el renderizado animado a NuevaMermaContent (Client Component).
 */
import { NuevaMermaContent } from "@/features/mermas"

export const metadata = {
  title: "Nueva Merma - FinanceTCP",
}

export default function NuevaMermaPage() {
  return <NuevaMermaContent />
}