'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface PendingMembership {
  membershipId: string
  user: {
    name: string
    email: string
  }
}

interface MembershipActionDialogProps {
  membership: PendingMembership | null
  open: boolean
  onClose: () => void
  onConfirm: (membershipId: string, tenantRole: string) => Promise<void>
}

/**
 * @description Diálogo para aprobar una solicitud de membresía, con selección de rol.
 * @param {MembershipActionDialogProps} props - Membresía, estado del diálogo, handlers
 * @returns {JSX.Element} Diálogo de confirmación con selector de rol
 */
export function MembershipActionDialog({
  membership,
  open,
  onClose,
  onConfirm,
}: MembershipActionDialogProps) {
  const [role, setRole] = useState('dependiente')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (!membership) return
    setIsSubmitting(true)
    try {
      await onConfirm(membership.membershipId, role)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && !isSubmitting) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprobar Acceso</DialogTitle>
          <DialogDescription>
            Estás por aprobar el acceso de{' '}
            <span className="font-medium">{membership?.user.name}</span> (
            {membership?.user.email}) a la empresa.
            Seleccioná el rol que se le asignará.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dependiente">Dependiente</SelectItem>
                <SelectItem value="economico">Económico</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aprobando...
              </>
            ) : (
              'Aprobar Acceso'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
