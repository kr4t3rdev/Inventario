import { redirect } from 'next/navigation';

import { getSalesAgentProfileAction } from '@/features/sales-agent/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * @description Página de perfil del Gestor de Ventas con datos de cuenta y del perfil activo.
 * @returns {Promise<React.JSX.Element>} Vista de perfil con la información del Gestor.
 */
export default async function SalesAgentProfilePage(): Promise<React.JSX.Element> {
  const result = await getSalesAgentProfileAction({});
  if (!result.success || !result.data) redirect('/sales-agent/referidos');

  const profile = result.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Tu perfil</h1>
        <p className="mt-2 text-muted-foreground">Datos de tu cuenta y de tu perfil de Gestor.</p>
      </header>

      <Card>
        <CardHeader><CardTitle asChild><h2>Cuenta</h2></CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Nombre</p>
            <p className="mt-1 text-muted-foreground">{profile.name || 'Sin especificar'}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Correo</p>
            <p className="mt-1 text-muted-foreground">{profile.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle asChild><h2>Perfil de Gestor</h2></CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Código de referido</p>
            <p className="mt-1 text-muted-foreground">{profile.referralCode || 'Sin asignar'}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Teléfono</p>
            <p className="mt-1 text-muted-foreground">{profile.phone || 'Sin especificar'}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Estado</p>
            <p className="mt-1 text-muted-foreground">{profile.status}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Registrado desde</p>
            <p className="mt-1 text-muted-foreground">
              {profile.createdAt
                ? new Date(profile.createdAt).toLocaleDateString('es', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : '—'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
