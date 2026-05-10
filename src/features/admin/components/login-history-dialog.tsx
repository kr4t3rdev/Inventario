'use client';

import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { format } from 'date-fns';
import { Lock, Sparkles, Unlock, XCircle } from 'lucide-react';

import { AdminTableLoader } from '@/features/admin/components/animations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getUserLoginHistoryAction } from '@/features/admin/actions'

interface LoginHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onUnlock: (userId: string) => void;
  onLock: (userId: string, reason?: string) => void;
}

/**
 * @description Intenta convertir detalles de log en objeto seguro sin romper el render.
 * @param {string | null} details - Texto serializado del log.
 * @returns {{ attemptNumber?: number }} Objeto con metadatos del intento.
 */
function parseAttemptDetails(details: string | null): { attemptNumber?: number } {
  if (!details) {
    return {};
  }

  try {
    return JSON.parse(details) as { attemptNumber?: number };
  } catch {
    return {};
  }
}

/**
 * @description Dialog para visualizar historial de login, intentos fallidos y bloqueos.
 * @param {LoginHistoryDialogProps} props - Configuración de apertura y acciones del usuario.
 * @returns {JSX.Element | null} Modal con datos de seguridad del usuario.
 */
export function LoginHistoryDialog({
  open,
  onClose,
  userId,
  userName,
  onUnlock,
  onLock,
}: LoginHistoryDialogProps): React.JSX.Element | null {
  const shouldReduceMotion = useReducedMotion();
  const [history, setHistory] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;

    setIsLoading(true);
    getUserLoginHistoryAction({ userId })
      .then((data) => {
        setHistory(data);
      })
      .catch(() => {
        setHistory(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [open, userId]);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-h-[82vh] overflow-y-auto border bg-background sm:max-w-[900px]">
          <div className="absolute left-0 right-0 top-0 h-1 bg-linear-to-r from-primary via-purple-500 to-primary" />
          <DialogHeader>
            <DialogTitle>Historial de Intentos de Login</DialogTitle>
            <DialogDescription>Cargando actividad de seguridad...</DialogDescription>
          </DialogHeader>
          <AdminTableLoader
            columns={4}
            rows={5}
            caption="Preparando historial de accesos..."
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (!history) {
    return null;
  }

  const isUserLocked = Boolean(
    history.user.lockedUntil && new Date(history.user.lockedUntil) > new Date(),
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[82vh] overflow-y-auto border bg-background sm:max-w-[900px]">
        <div className="absolute left-0 right-0 top-0 h-1 bg-linear-to-r from-primary via-purple-500 to-primary" />
        <DialogHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary to-purple-600 shadow-md">
                  <Lock className="h-4 w-4 text-white" />
                </span>
                <span className="bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
                  Historial de Intentos de Login
                </span>
                <Sparkles className="h-4 w-4 text-yellow-400" />
              </DialogTitle>
              <DialogDescription>Usuario: {userName}</DialogDescription>
            </div>
            <div className="flex gap-2">
              {isUserLocked ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUnlock(userId)}
                  className="text-emerald-700 dark:text-emerald-300"
                >
                  <Unlock className="mr-2 h-4 w-4" />
                  Desbloquear
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onLock(userId)}
                  className="text-rose-700 dark:text-rose-300"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Bloquear
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <motion.div
          className="space-y-6 py-2"
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border bg-card">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Estado actual</p>
                <div className="mt-1 text-lg font-semibold">
                  {isUserLocked ? (
                    <Badge variant="destructive">Bloqueado</Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    >
                      Activo
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border bg-card">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Intentos fallidos</p>
                <p className="mt-1 text-lg font-semibold">{history.user.loginAttempts} / 5</p>
              </CardContent>
            </Card>
            <Card className="border bg-card">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Último fallo</p>
                <p className="mt-1 text-lg font-semibold">
                  {history.user.lastFailedLogin
                    ? format(new Date(history.user.lastFailedLogin), 'dd/MM/yyyy HH:mm')
                    : 'N/A'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold">Últimos Intentos Fallidos</h3>
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead>Fecha</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>User Agent</TableHead>
                    <TableHead>Intento #</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.failedAttempts.length > 0 ? (
                    history.failedAttempts.map((log, index) => {
                      const details = parseAttemptDetails(log.details);
                      return (
                        <TableRow
                          key={log.id}
                          className={shouldReduceMotion ? '' : 'animate-fade-in'}
                          style={
                            shouldReduceMotion
                              ? undefined
                              : {
                                  animationDelay: `${Math.min(index * 40, 280)}ms`,
                                  animationFillMode: 'both',
                                }
                          }
                        >
                          <TableCell>{format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss')}</TableCell>
                          <TableCell className="text-sm">{log.ipAddress || 'N/A'}</TableCell>
                          <TableCell className="max-w-xs truncate text-xs">{log.userAgent || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              {details.attemptNumber || '?'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No hay intentos fallidos registrados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold">Actividad Relacionada</h3>
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead>Acción</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Detalles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.logs.length > 0 ? (
                    history.logs.map((log, index) => (
                      <TableRow
                        key={log.id}
                        className={shouldReduceMotion ? '' : 'animate-fade-in'}
                        style={
                          shouldReduceMotion
                            ? undefined
                            : {
                                animationDelay: `${Math.min(index * 40, 280)}ms`,
                                animationFillMode: 'both',
                              }
                        }
                      >
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              log.action === 'unlock_user'
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                            }
                          >
                            {log.action === 'unlock_user' ? 'Desbloqueado' : 'Bloqueado'}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss')}</TableCell>
                        <TableCell className="text-sm">{log.ipAddress || 'N/A'}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs">{log.details || 'N/A'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No hay actividad relacionada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </motion.div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
