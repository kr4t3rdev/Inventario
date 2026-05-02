'use client';

import type React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, Save, UserPen } from 'lucide-react';
import { toast } from 'sonner';

import { Usuario } from '@/app/models/model';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useUpdateUserMutation } from '@/lib/redux/services/adminApi';

interface EditUserDialogProps {
  open: boolean;
  onClose: () => void;
  user: Usuario;
}

interface EditUserFormState {
  name: string;
  email: string;
  password: string;
  role: 'regularUser' | 'dependiente' | 'admin';
  isActive: boolean;
  daysToExpire: string;
}

const INITIAL_FORM_STATE: EditUserFormState = {
  name: '',
  email: '',
  password: '',
  role: 'regularUser',
  isActive: true,
  daysToExpire: '',
};

/**
 * @description Dialog para editar usuarios existentes con interfaz optimizada para admin.
 * @param {EditUserDialogProps} props - Estado de apertura, cierre y usuario seleccionado.
 * @returns {JSX.Element} Modal de edición con validaciones visuales.
 */
export function EditUserDialog({ open, onClose, user }: EditUserDialogProps): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const [formData, setFormData] = useState<EditUserFormState>(INITIAL_FORM_STATE);
  const [loading, setLoading] = useState(false);
  const [updateUser] = useUpdateUserMutation();

  useEffect(() => {
    if (!user) {
      return;
    }

    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: (user.role as EditUserFormState['role']) || 'regularUser',
      isActive: Boolean(user.isActive),
      daysToExpire: '',
    });
  }, [user]);

  const handleNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: event.target.value }));
  }, []);

  const handleEmailChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, email: event.target.value }));
  }, []);

  const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, password: event.target.value }));
  }, []);

  const handleRoleChange = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, role: value as EditUserFormState['role'] }));
  }, []);

  const handleIsActiveChange = useCallback((checked: boolean) => {
    setFormData((prev) => ({ ...prev, isActive: checked }));
  }, []);

  const handleDaysToExpireChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, daysToExpire: event.target.value }));
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setLoading(true);

    try {
      const parsedDays = formData.daysToExpire
        ? Number.parseInt(formData.daysToExpire, 10)
        : undefined;

      await updateUser({
        userId: user.userId,
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        isActive: formData.isActive,
        ...(formData.password ? { password: formData.password } : {}),
        ...(parsedDays && !Number.isNaN(parsedDays) ? { daysToExpire: parsedDays } : {}),
      }).unwrap();

      toast.success('Usuario actualizado correctamente');
      onClose();
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      toast.error('Error al actualizar usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleDialogChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="overflow-hidden border bg-background sm:max-w-125">
        <div className="absolute left-0 right-0 top-0 h-1 bg-linear-to-r from-primary via-purple-500 to-primary" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary to-purple-600 shadow-md">
              <UserPen className="h-4 w-4 text-white" />
            </span>
            <span className="bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
              Editar Usuario
            </span>
          </DialogTitle>
          <DialogDescription>
            Actualiza la información de la cuenta seleccionada.
          </DialogDescription>
        </DialogHeader>

        <motion.form
          onSubmit={handleSubmit}
          className="space-y-4"
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
        >
          <div className="grid gap-4 py-1">
             <div className="space-y-2">
               <Label htmlFor="edit-name">Nombre</Label>
               <Input
                 id="edit-name"
                 value={formData.name}
                 onChange={handleNameChange}
                 className="h-11 border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-800/50"
                 required
               />
             </div>

             <div className="space-y-2">
               <Label htmlFor="edit-email">Email</Label>
               <Input
                 id="edit-email"
                 type="email"
                 value={formData.email}
                 onChange={handleEmailChange}
                 className="h-11 border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-800/50"
                 required
               />
             </div>

             <div className="space-y-2">
               <Label htmlFor="edit-password">Nueva contraseña</Label>
               <Input
                 id="edit-password"
                 type="password"
                 value={formData.password}
                 onChange={handlePasswordChange}
                 placeholder="Déjalo vacío para mantener la actual"
                 minLength={6}
                 className="h-11 border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-800/50"
               />
             </div>

            <div className="grid gap-4 sm:grid-cols-2">
               <div className="space-y-2">
                 <Label htmlFor="edit-role">Rol de plataforma</Label>
                 <Select
                   value={formData.role}
                   onValueChange={handleRoleChange}
                 >
                   <SelectTrigger id="edit-role" className="h-11 border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-800/50">
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="regularUser">Usuario</SelectItem>
                     <SelectItem value="dependiente">Dependiente</SelectItem>
                     <SelectItem value="admin">Administrador</SelectItem>
                   </SelectContent>
                 </Select>
                 <p className="text-xs text-muted-foreground">
                   El rol operativo del tenant se conserva en la membresía activa.
                 </p>
               </div>

               <div className="space-y-2 rounded-lg border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/40">
                 <Label htmlFor="edit-is-active">Usuario Activo</Label>
                 <div className="flex items-center justify-between">
                   <p className="text-xs text-muted-foreground">
                     Controla acceso al sistema en tiempo real.
                   </p>
                   <Switch
                     id="edit-is-active"
                     checked={formData.isActive}
                     onCheckedChange={handleIsActiveChange}
                   />
                 </div>
               </div>
            </div>

             <div className="space-y-2 rounded-lg border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/40">
               <Label htmlFor="edit-days">Extender días</Label>
               <Input
                 id="edit-days"
                 type="number"
                 value={formData.daysToExpire}
                 onChange={handleDaysToExpireChange}
                 min={1}
                 placeholder="Días adicionales"
                 className="h-11 border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-800/50"
               />
             </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogChange(false)}
              className="border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/60"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="min-w-40 bg-linear-to-r from-primary to-purple-600 text-white hover:from-primary/90 hover:to-purple-600/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </motion.form>
      </DialogContent>
    </Dialog>
  );
}
