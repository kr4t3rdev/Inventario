'use client'

import { useEffect, useState } from "react"

import { getFirmantesAction } from "@/features/contratos/actions"
import { AddFirmaDialog } from "@/features/contratos/components/add-firma-dialog"

interface Firmante {
  userId: string
  name: string
}

interface AddFirmaSectionProps {
  contratoId: string
  /** Si el usuario puede gestionar contratos (y por tanto firmar). */
  puedeFirmar: boolean
  /** Callback invocado tras registrar la firma para refrescar el detalle. */
  onSuccess: () => void
}

/**
 * @description Sección de firmas del contrato: resuelve en el cliente el
 *              padrón de firmantes elegibles (miembros activos del tenant) y
 *              monta el diálogo de registro de firma. Si el usuario no puede
 *              gestionar contratos, no se renderiza ninguna acción.
 * @param {AddFirmaSectionProps} props - Contrato destino, permiso y callback
 *   de refresco.
 * @returns {JSX.Element | null} Acción de agregar firma o null si no aplica.
 */
export function AddFirmaSection({ contratoId, puedeFirmar, onSuccess }: AddFirmaSectionProps) {
  const [firmantes, setFirmantes] = useState<Firmante[]>([])

  useEffect(() => {
    if (!puedeFirmar) return
    void getFirmantesAction().then((result) => {
      if (result.success && result.data) setFirmantes(result.data.firmantes)
    })
  }, [puedeFirmar])

  if (!puedeFirmar) return null

  return (
    <AddFirmaDialog
      contratoId={contratoId}
      users={firmantes}
      onSuccess={onSuccess}
    />
  )
}
