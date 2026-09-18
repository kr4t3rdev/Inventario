'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { LazyMotion, m as motion, useReducedMotion } from 'framer-motion';
import { BarChart3, Layers3, MapPinned, PackageSearch, Repeat2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { StaggerContainer, StaggerItem, AnimatedCard } from '@/components/ui/animations';


const tabTriggerClass = cn(
  'gap-2 rounded-lg border border-transparent text-xs sm:text-sm',
  'data-[state=active]:border-slate-200 data-[state=active]:bg-white data-[state=active]:shadow-sm'
);

export interface TransferenciaMovimientos {
  transferenciaId: string;
  productoId: string;
  productoNombre: string;
  productoCodigoInterno?: string | null;
  cantidad: number;
  createdAt: string;
  updatedAt?: string;
  estado?: string;
  tipoTransferencia?: string;
  origenNombre?: string;
  destinoNombre?: string;
}

/** Etiquetas visibles de cada pestaña (evita exponer el id interno). */
const TAB_LABELS: Record<string, string> = {
  general: 'General',
  categoria: 'Categoría',
  ubicacion: 'Ubicación',
  movimientos: 'Movimientos',
};

interface ReportesInventarioProps {
  initialTransferencias: TransferenciaMovimientos[];
}

/**
 * @description Loader de sección para tabs de reportes.
 * @returns {JSX.Element} Skeleton base para el contenido de pestañas.
 */
function ReportesSectionLoader() {
  return (
    <div className='space-y-4 p-4'>
      <Skeleton className='h-10 w-64 rounded-lg' />
      <Skeleton className='h-115 w-full rounded-xl' />
    </div>
  );
}

const ReporteGeneral = dynamic(
  () => import('./reporte-general').then((mod) => ({ default: mod.ReporteGeneral })),
  { loading: () => <ReportesSectionLoader /> },
);
const ReportePorCategoria = dynamic(
  () => import('./reporte-por-categoria').then((mod) => ({ default: mod.ReportePorCategoria })),
  { loading: () => <ReportesSectionLoader /> },
);
const ReportePorUbicacion = dynamic(
  () => import('./reporte-por-ubicacion').then((mod) => ({ default: mod.ReportePorUbicacion })),
  { loading: () => <ReportesSectionLoader /> },
);
const ReporteMovimientos = dynamic(
  () => import('./reporte-movimientos').then((mod) => ({ default: mod.ReporteMovimientos })),
  { loading: () => <ReportesSectionLoader /> },
);

/**
 * @description Vista principal con pestañas para los reportes de inventario.
 * @returns {JSX.Element} Panel de reportes con transiciones y metadatos de vista.
 */
import { SURFACE_CARD_CLASS } from "@/features/reportes-financieros/lib/reporte-styles"

export default function ReportesInventario({ initialTransferencias }: ReportesInventarioProps) {
  const [activeTab, setActiveTab] = useState('general');
  const shouldReduceMotion = useReducedMotion();

  return (
    <StaggerContainer className='space-y-5 p-6'>
      <StaggerItem>
        <Card className={cn(SURFACE_CARD_CLASS, 'border-dashed')}>
          <CardHeader className='flex flex-col gap-3 pb-4 sm:flex-row sm:items-end sm:justify-between'>
            <div className='space-y-1'>
              <CardTitle className='text-xl text-slate-900 dark:text-slate-100'>
                Centro de Reportes
              </CardTitle>
              <CardDescription>
                Selecciona una vista para revisar inventario global, categoría, ubicación y
                movimientos.
              </CardDescription>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Badge variant='outline' className='h-8 px-3'>
                <Layers3 className='mr-1.5 h-3.5 w-3.5' />
                Vista activa: {TAB_LABELS[activeTab] ?? activeTab}
              </Badge>
              <Badge variant='outline' className='h-8 px-3'>
                Datos del inventario
              </Badge>
            </div>
          </CardHeader>
        </Card>
      </StaggerItem>

      <StaggerItem>
        <AnimatedCard>
        <Card className={SURFACE_CARD_CLASS}>
          <CardContent className='p-4 sm:p-5'>
            <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full space-y-4'>
              <TabsList className='grid h-auto w-full grid-cols-2 gap-2 rounded-xl p-1 sm:grid-cols-4 dark:bg-slate-900/10'>
                <TabsTrigger value='general' className={tabTriggerClass}>
                  <BarChart3 className='h-3.5 w-3.5' />
                  General
                </TabsTrigger>
                <TabsTrigger value='categoria' className={tabTriggerClass}>
                  <PackageSearch className='h-3.5 w-3.5' />
                  Categoría
                </TabsTrigger>
                <TabsTrigger value='ubicacion' className={tabTriggerClass}>
                  <MapPinned className='h-3.5 w-3.5' />
                  Ubicación
                </TabsTrigger>
                <TabsTrigger value='movimientos' className={tabTriggerClass}>
                  <Repeat2 className='h-3.5 w-3.5' />
                  Movimientos
                </TabsTrigger>
              </TabsList>

              <TabsContent value='general' className='mt-0'>
                <motion.div
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                >
                  <ReporteGeneral />
                </motion.div>
              </TabsContent>

              <TabsContent value='categoria' className='mt-0'>
                <motion.div
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                >
                  <ReportePorCategoria />
                </motion.div>
              </TabsContent>

              <TabsContent value='ubicacion' className='mt-0'>
                <motion.div
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                >
                  <ReportePorUbicacion />
                </motion.div>
              </TabsContent>

              <TabsContent value='movimientos' className='mt-0'>
                <motion.div
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                >
                  <ReporteMovimientos initialTransferencias={initialTransferencias} />
                </motion.div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        </AnimatedCard>
      </StaggerItem>
    </StaggerContainer>
  );
}
