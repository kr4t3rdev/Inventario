'use client';

import type React from 'react';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, PlusCircle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

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
import { useAddUserMutation } from '@/lib/redux/services/adminApi';

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
}

interface CreateUserFormState {
  name: string;
  email: string;
  password: string;
  role: 'regularUser' | 'dependiente' | 'admin';
  daysToExpire: string;
}

const INITIAL_FORM_STATE: CreateUserFormState = {
  name: '',
  email: '',
  password: '',
  role: 'regularUser',
  daysToExpire: '',
};

/**
 * @description Dialog para crear usuarios nuevos con estilo mejorado, dark mode y animaciones.
 * @param {CreateUserDialogProps} props - Estado de apertura y callback de cierre.
 * @returns {JSX.Element} Formulario modal de creación de usuarios.
 */
export function CreateUserDialog({ open, onClose }: CreateUserDialogProps): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const [formData, setFormData] = useState<CreateUserFormState>(INITIAL_FORM_STATE);
  const [loading, setLoading] = useState(false);
  const [addUser] = useAddUserMutation();

  const resetForm = (): void => {
    setFormData(INITIAL_FORM_STATE);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setLoading(true);

    try {
      const parsedDays = formData.daysToExpire
        ? Number.parseInt(formData.daysToExpire, 10)
        : undefined;

      await addUser({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        daysToExpire: Number.isNaN(parsedDays) ? undefined : parsedDays,
      }).unwrap();

      toast.success('Usuario creado exitosamente');
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error al crear usuario:', error);
      toast.error('Error al crear usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleDialogChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="overflow-hidden border bg-background sm:max-w-[480px]">
        <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-600 shadow-md">
              <PlusCircle className="h-4 w-4 text-white" />
            </span>
            <span className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
              Crear Nuevo Usuario
            </span>
          </DialogTitle>
          <DialogDescription>
            Completa los datos para crear una nueva cuenta dentro del sistema.
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
              <Label htmlFor="create-name">Nombre</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                placeholder="Nombre completo"
                className="h-11 border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-800/50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                placeholder="usuario@empresa.com"
                className="h-11 border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-800/50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-password">Contraseña</Label>
              <Input
                id="create-password"
                type="password"
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                placeholder="Mínimo 6 caracteres"
                className="h-11 border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-800/50"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-role">Rol</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value as CreateUserFormState['role'] })
                }
              >
                <SelectTrigger id="create-role" className="h-11 border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-800/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regularUser">Usuario Regular</SelectItem>
                  <SelectItem value="dependiente">Dependiente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rounded-lg border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/40">
              <Label htmlFor="create-days">Días hasta expirar</Label>
              <Input
                id="create-days"
                type="number"
                value={formData.daysToExpire}
                onChange={(event) =>
                  setFormData({ ...formData, daysToExpire: event.target.value })
                }
                min={1}
                placeholder="Opcional (sin límite)"
                className="h-11 border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-800/50"
              />
              <p className="text-xs text-muted-foreground">
                Si queda vacío, la cuenta no tendrá fecha de expiración.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogChange(false)}
              disabled={loading}
              className="border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/60"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="min-w-36 bg-gradient-to-r from-primary to-purple-600 text-white hover:from-primary/90 hover:to-purple-600/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Crear Usuario
                </>
              )}
            </Button>
          </DialogFooter>
        </motion.form>
      </DialogContent>
    </Dialog>
  );
}
