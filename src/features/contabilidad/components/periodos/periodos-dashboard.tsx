/**
 * @description Dashboard de períodos contables.
 *
 * Muestra cards con estadísticas agregadas: total por estado,
 * períodos listos para cerrar, períodos con issues, y timeline
 * de eventos recientes.
 */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, CheckCircle2, AlertCircle, Clock, Activity, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface DashboardData {
  stats: {
    total: number;
    porEstado: Record<string, number>;
    listosParaCerrar: number;
    conIssues: number;
  };
  periodos: Array<{
    periodoId: string;
    tipo: string;
    codigo: string | null;
    estado: string;
    fechaInicio: string;
    fechaFin: string;
  }>;
  eventosRecientes: Array<{
    auditoriaId: string;
    evento: string;
    actor: string;
    timestamp: string;
    motivo: string | null;
    periodoId: string;
  }>;
}

const ESTADO_LABELS: Record<string, string> = {
  ABIERTO: 'Abiertos',
  EN_CIERRE: 'En Cierre',
  CERRADO: 'Cerrados',
  APROBADO: 'Aprobados',
  REABIERTO: 'Reabiertos',
  BORRADOR: 'Borradores',
};

const ESTADO_COLORS: Record<string, string> = {
  ABIERTO: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950',
  CERRADO: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950',
  APROBADO: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  REABIERTO: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950',
};

const EVENTO_ICONS: Record<string, typeof Activity> = {
  APERTURA: Calendar,
  CIERRE: LockIcon,
  APROBACION: CheckCircle2,
  REAPERTURA: Clock,
};

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function PeriodosDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { obtenerDashboardPeriodosAction } = await import('@/features/contabilidad/actions-periodos');
      const result = await obtenerDashboardPeriodosAction({});
      if (result.success && result.data) {
        setData(result.data as DashboardData);
      } else {
        setError(result.error?.message ?? 'Error al cargar dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-2" />
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { stats, eventosRecientes } = data;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Períodos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className={stats.listosParaCerrar > 0 ? 'border-green-200 dark:border-green-800' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              Listos para Cerrar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.listosParaCerrar}</div>
          </CardContent>
        </Card>

        <Card className={stats.conIssues > 0 ? 'border-red-200 dark:border-red-800' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-destructive" />
              Con Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{stats.conIssues}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Distribución</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {Object.entries(stats.porEstado).map(([estado, count]) => (
              <div key={estado} className="flex justify-between text-xs">
                <span>{ESTADO_LABELS[estado] ?? estado}</span>
                <span className="font-medium">{count as number}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Eventos Recientes */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>Últimos eventos de cierre, aprobación y apertura</CardDescription>
        </CardHeader>
        <CardContent>
          {eventosRecientes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin actividad registrada</p>
          ) : (
            <div className="space-y-3">
              {eventosRecientes.map((evento) => {
                const Icon = EVENTO_ICONS[evento.evento] ?? Activity;
                return (
                  <div key={evento.auditoriaId} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {evento.evento}
                        </Badge>
                        <span className="text-muted-foreground truncate">{evento.actor}</span>
                      </div>
                      {evento.motivo && (
                        <p className="text-xs text-muted-foreground mt-1">{evento.motivo}</p>
                      )}
                    </div>
                    <time className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(evento.timestamp), 'dd/MM HH:mm')}
                    </time>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
