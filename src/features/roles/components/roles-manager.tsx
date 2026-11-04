'use client';

/**
 * @description Panel de gestión de roles personalizados del tenant: listado,
 * creación/edición con matriz de permisos, borrado con guarda de miembros y
 * asignación de rol a las membresías activas.
 * Copia en español neutro; el servidor siempre revalida permisos.
 *
 * @returns {JSX.Element} Panel de roles.
 */
import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  listTenantRolesAction,
  listTenantMembersAction,
  createTenantRoleAction,
  updateTenantRoleAction,
  deleteTenantRoleAction,
  assignCustomRoleAction,
} from '@/features/roles/actions';
import { SettingsPageShell } from '@/features/configuracion/components/settings-page-shell';
import { PermissionMatrix } from './permission-matrix';

interface RoleRow {
  roleId: string;
  nombre: string;
  descripcion: string | null;
  permissions: string[];
  isActive: boolean;
}
interface MemberRow {
  membershipId: string;
  userId: string;
  tenantRole: string;
  customRoleId: string | null;
  user: { name: string; email?: string };
}

export function RolesManager() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulario de rol (crear o editar)
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [r, m] = await Promise.all([listTenantRolesAction(undefined), listTenantMembersAction(undefined)]);
    if (!r.success) {
      setError(r.error?.message ?? 'No se pudieron cargar los roles');
    } else if (!m.success) {
      setError(m.error?.message ?? 'No se pudieron cargar los roles');
    } else {
      setRoles((r.data.roles ?? []).map((role) => ({
        ...role,
        permissions: Array.isArray(role.permissions)
          ? role.permissions.filter(
            (permission): permission is string => typeof permission === 'string',
          )
          : [],
      })));
      setMembers(m.data.memberships ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setNombre('');
    setDescripcion('');
    setSelectedKeys([]);
    setOpen(true);
  };

  const openEdit = (r: RoleRow) => {
    setEditing(r);
    setNombre(r.nombre);
    setDescripcion(r.descripcion ?? '');
    setSelectedKeys(Array.isArray(r.permissions) ? r.permissions : []);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const r = editing
      ? await updateTenantRoleAction({ roleId: editing.roleId, nombre, descripcion, permissions: selectedKeys })
      : await createTenantRoleAction({ nombre, descripcion, permissions: selectedKeys });
    setSaving(false);
    if (!r.success) {
      setError(r.error?.message ?? 'Error al guardar el rol');
      return;
    }
    setOpen(false);
    await load();
  };

  const remove = async (role: RoleRow) => {
    const ok = window.confirm(
      `¿Eliminar el rol "${role.nombre}"? Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    const r = await deleteTenantRoleAction(role.roleId);
    if (!r.success) {
      setError(r.error?.message ?? 'No se pudo eliminar el rol');
      return;
    }
    await load();
  };

  const assign = async (membershipId: string, customRoleId: string) => {
    const r = await assignCustomRoleAction({
      membershipId,
      customRoleId: customRoleId === '__none__' ? null : customRoleId,
    });
    if (!r.success) {
      setError(r.error?.message ?? 'No se pudo asignar el rol');
      return;
    }
    await load();
  };

  return (
    <SettingsPageShell
      icon={ShieldCheck}
      title="Roles"
      description="Administra los roles personalizados y los permisos de tu equipo."
      actions={!loading ? <Button onClick={openCreate}>Crear rol</Button> : undefined}
    >
      {loading ? (
        <p
          role="status"
          className="rounded-xl border border-border/80 bg-card p-4 text-sm text-muted-foreground shadow-sm"
        >
          Cargando roles…
        </p>
      ) : (
        <>
          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {roles.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/80 bg-card/60 p-6 text-sm text-muted-foreground">
              Aún no hay roles personalizados. Crea uno para combinar permisos a medida.
            </p>
          ) : (
            <ul className="space-y-3">
              {roles.map((r) => (
                <li
                  key={r.roleId}
                  className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      {r.nombre}
                      {!r.isActive && (
                        <Badge variant="outline" className="ml-2">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Array.isArray(r.permissions) ? r.permissions.length : 0} permisos
                      {r.descripcion ? ` · ${r.descripcion}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                      Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => remove(r)}>
                      Eliminar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <section
            aria-label="Asignación de roles a usuarios"
            className="space-y-4 rounded-xl border border-border/80 bg-card p-5 shadow-sm"
          >
            <div>
              <h2 className="text-base font-semibold">Asignar rol a usuarios</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Selecciona el perfil que corresponde a cada miembro.
              </p>
            </div>
            <ul className="space-y-3">
              {members.map((m) => (
                <li
                  key={m.membershipId}
                  className="flex flex-col gap-3 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">{m.user?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Rol fijo: <Badge variant="secondary">{m.tenantRole}</Badge>
                    </div>
                  </div>
                  <Select
                    value={m.customRoleId ?? '__none__'}
                    onValueChange={(v) => assign(m.membershipId, v)}
                  >
                    <SelectTrigger
                      className="w-full sm:w-56"
                      aria-label={`Rol de ${m.user?.name}`}
                    >
                      <SelectValue placeholder="Rol personalizado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin rol personalizado</SelectItem>
                      {roles
                        .filter((r) => r.isActive)
                        .map((r) => (
                          <SelectItem key={r.roleId} value={r.roleId}>
                            {r.nombre}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Editar rol: ${editing.nombre}` : 'Crear rol personalizado'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="rol-nombre">Nombre</Label>
              <Input
                id="rol-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Cajero"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rol-descripcion">Descripción</Label>
              <Textarea
                id="rol-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Permisos</Label>
              <PermissionMatrix selectedKeys={selectedKeys} onChange={setSelectedKeys} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving || !nombre.trim()}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SettingsPageShell>
  );
}
