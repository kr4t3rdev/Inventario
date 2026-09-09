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
import { PermissionMatrix } from './permission-matrix';

interface RoleRow {
  roleId: string;
  nombre: string;
  descripcion: string | null;
  permissions: string[];
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
    if (r.success && m.success) {
      setRoles(r.data.roles ?? []);
      setMembers(m.data.memberships ?? []);
    } else {
      const msg = r.success ? m.error?.message : r.error?.message;
      setError(msg ?? 'No se pudieron cargar los roles');
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

  if (loading) return <p role="status">Cargando roles…</p>;

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Roles personalizados</h2>
        <Button onClick={openCreate}>Crear rol</Button>
      </div>

      {roles.length === 0 ? (
        <p className="text-muted-foreground">
          Aún no hay roles personalizados. Crea uno para combinar permisos a medida.
        </p>
      ) : (
        <ul className="space-y-2">
          {roles.map((r) => (
            <li key={r.roleId} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{r.nombre}</div>
                <div className="text-xs text-muted-foreground">
                  {Array.isArray(r.permissions) ? r.permissions.length : 0} permisos
                  {r.descripcion ? ` · ${r.descripcion}` : ''}
                </div>
              </div>
              <div className="flex gap-2">
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

      <section aria-label="Asignación de roles a usuarios">
        <h3 className="text-lg font-semibold mb-2">Asignar rol a usuarios</h3>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.membershipId} className="flex items-center justify-between rounded-md border p-3">
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
                <SelectTrigger className="w-56" aria-label={`Rol de ${m.user?.name}`}>
                  <SelectValue placeholder="Rol personalizado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin rol personalizado</SelectItem>
                  {roles.map((r) => (
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar rol: ${editing.nombre}` : 'Crear rol personalizado'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="rol-nombre">Nombre</Label>
              <Input id="rol-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Cajero" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rol-descripcion">Descripción</Label>
              <Textarea id="rol-descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Permisos</Label>
              <PermissionMatrix selectedKeys={selectedKeys} onChange={setSelectedKeys} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving || !nombre.trim()}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}