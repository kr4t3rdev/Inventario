'use client';

import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CheckCircle,
  Clock,
  Download,
  Edit,
  Loader2,
  Search,
  Shield,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Usuario } from '@/app/models/model';
import { AdminTableLoader } from '@/components/admin/animations';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription } from '@/components/ui/alert-dialog';
import { AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDeleteUserMutation } from '@/lib/redux/services/adminApi';
import { getAuthToken } from '@/lib/token';

interface AdminUsersTableProps {
  users: Usuario[];
  isLoading: boolean;
  onEditUser: (user: Usuario) => void;
  onRefresh: () => Promise<unknown> | void;
}

type RoleFilter = 'all' | 'admin' | 'dependiente' | 'regularUser';
type StatusFilter = 'all' | 'active' | 'inactive';

/**
 * @description Tabla de administracion de usuarios con filtros, exportación y acciones.
 * @param {AdminUsersTableProps} props - Datos y callbacks del modulo.
 * @returns {JSX.Element} Tabla interactiva con estados de carga y animaciones.
 */
export function AdminUsersTable({
  users,
  isLoading,
  onEditUser,
  onRefresh,
}: AdminUsersTableProps): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [deleteUser] = useDeleteUserMutation();

  const filteredUsers = useMemo(() => {
    return users.filter((candidate) => {
      const matchesSearch =
        candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || candidate.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && candidate.isActive) ||
        (statusFilter === 'inactive' && !candidate.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchTerm, statusFilter, users]);

  const getRoleBadge = (role: string): React.JSX.Element => {
    switch (role) {
      case 'admin':
        return (
          <Badge
            variant="outline"
            className="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
          >
            <Shield className="mr-1 h-3 w-3" />
            Admin
          </Badge>
        );
      case 'dependiente':
        return (
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          >
            <User className="mr-1 h-3 w-3" />
            Dependiente
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="border-border/80 bg-muted/40 text-foreground"
          >
            <User className="mr-1 h-3 w-3" />
            Usuario
          </Badge>
        );
    }
  };

  const getStatusBadge = (isActive: boolean, expiresAt?: string): React.JSX.Element => {
    if (!isActive) {
      return (
        <Badge variant="destructive" className="bg-rose-600/90 dark:bg-rose-600">
          <XCircle className="mr-1 h-3 w-3" />
          Inactivo
        </Badge>
      );
    }

    if (expiresAt) {
      const daysUntilExpiry = Math.ceil(
        (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntilExpiry <= 0) {
        return (
          <Badge variant="destructive">
            <Clock className="mr-1 h-3 w-3" />
            Expirado
          </Badge>
        );
      }

      if (daysUntilExpiry <= 7) {
        return (
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          >
            <Clock className="mr-1 h-3 w-3" />
            Expira en {daysUntilExpiry}d
          </Badge>
        );
      }
    }

    return (
      <Badge
        variant="outline"
        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      >
        <CheckCircle className="mr-1 h-3 w-3" />
        Activo
      </Badge>
    );
  };

  const handleDeleteUser = async (userId: string): Promise<void> => {
    try {
      await deleteUser(userId).unwrap();
      toast.success('Usuario eliminado correctamente');
      await onRefresh();
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      toast.error('Error al eliminar usuario');
    }
  };

  const handleExport = async (): Promise<void> => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/admin/users/export?format=csv', {
        headers: {
          Authorization: getAuthToken(),
        },
      });

      if (!response.ok) {
        throw new Error('Error al exportar usuarios');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `usuarios_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);

      toast.success('Usuarios exportados correctamente');
    } catch (error) {
      console.error('Error al exportar usuarios:', error);
      toast.error('Error al exportar usuarios');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <AdminTableLoader
        columns={7}
        rows={6}
        caption="Cargando usuarios y permisos..."
      />
    );
  }

  return (
    <div className="space-y-4">
      <motion.div
        initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
        className="rounded-xl border border bg-card p-3 shadow-sm"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Resultados: {filteredUsers.length}
          </p>
          <Badge variant="outline" className="bg-primary/10 text-primary">
            Gestión de usuarios
          </Badge>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-11 border-slate-200 bg-white/60 pl-10 dark:border-slate-700 dark:bg-slate-800/50"
            />
          </div>
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
            <SelectTrigger className="h-11 w-full border-slate-200 bg-white/60 sm:w-44 dark:border-slate-700 dark:bg-slate-800/50">
              <SelectValue placeholder="Filtrar por rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              <SelectItem value="admin">Administradores</SelectItem>
              <SelectItem value="dependiente">Dependientes</SelectItem>
              <SelectItem value="regularUser">Usuarios</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="h-11 w-full border-slate-200 bg-white/60 sm:w-44 dark:border-slate-700 dark:bg-slate-800/50">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            className="h-11 border-slate-200 bg-white/70 transition-all duration-200 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isExporting ? 'Exportando...' : 'Exportar'}
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
        className="overflow-hidden rounded-xl border border bg-card shadow-sm"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-primary/10 via-purple-600/5 to-primary/10">
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha de Creación</TableHead>
              <TableHead>Expira</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((candidate, index) => (
              <TableRow
                key={candidate.userId}
                className={shouldReduceMotion ? '' : 'animate-fade-in'}
                style={
                  shouldReduceMotion
                    ? undefined
                    : {
                        animationDelay: `${Math.min(index * 45, 320)}ms`,
                        animationFillMode: 'both',
                      }
                }
              >
                <TableCell className="font-medium">{candidate.name}</TableCell>
                <TableCell>{candidate.email}</TableCell>
                <TableCell>{getRoleBadge(candidate.role)}</TableCell>
                <TableCell>{getStatusBadge(candidate.isActive, candidate.expiresAt)}</TableCell>
                <TableCell>{format(new Date(candidate.createdAt), 'dd/MM/yyyy')}</TableCell>
                <TableCell>
                  {candidate.expiresAt ? (
                    format(new Date(candidate.expiresAt), 'dd/MM/yyyy')
                  ) : (
                    <span className="text-muted-foreground">Sin límite</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditUser(candidate)}
                      className="border-slate-200 bg-white/70 transition-all duration-200 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-200 bg-white/70 text-rose-600 transition-all duration-200 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-rose-400 dark:hover:text-rose-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-slate-200/70 bg-white/90 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/90">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar Usuario</AlertDialogTitle>
                          <AlertDialogDescription>
                            ¿Estás seguro de que quieres eliminar este usuario?
                            Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <Button
                            onClick={() => handleDeleteUser(candidate.userId)}
                            variant="destructive"
                          >
                            Eliminar
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </motion.div>

      {filteredUsers.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 py-8 text-center text-muted-foreground dark:bg-muted/10">
          No se encontraron usuarios que coincidan con los filtros.
        </div>
      )}
    </div>
  );
}
