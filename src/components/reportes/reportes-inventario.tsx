'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BarChart3, Layers3, MapPinned, PackageSearch, Repeat2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { StaggerContainer, StaggerItem, AnimatedCard } from '@/components/ui/animations';

const surfaceCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-950/50',
);

const tabTriggerClass = cn(
  'gap-2 rounded-lg border border-transparent text-xs sm:text-sm',
  'data-[state=active]:border-slate-200 data-[state=active]:bg-white data-[state=active]:shadow-sm'
);

/**
 * @description Loader de sección para tabs de reportes.
 * @returns {JSX.Element} Skeleton base para el contenido de pestañas.
 */
function ReportesSectionLoader() {
  return (
    <div className='space-y-4 p-4'>
      <Skeleton className='h-10 w-64 rounded-lg' />
      <Skeleton className='h-[460px] w-full rounded-xl' />
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
export default function ReportesInventario() {
  const [activeTab, setActiveTab] = useState('general');
  const shouldReduceMotion = useReducedMotion();

  return (
    <StaggerContainer className='space-y-5 p-6'>
      <StaggerItem>
        <Card className={cn(surfaceCardClass, 'border-dashed')}>
          <CardHeader className='flex flex-col gap-3 pb-4 sm:flex-row sm:items-end sm:justify-between'>
            <div className='space-y-1'>
              <CardTitle className='text-xl text-slate-900 dark:text-slate-100'>
                Centro de Reportes
              </CardTitle>
              <CardDescription>
                Seleccione una vista para revisar inventario global, categoría, ubicación y
                movimientos.
              </CardDescription>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Badge variant='outline' className='h-8 px-3'>
                <Layers3 className='mr-1.5 h-3.5 w-3.5' />
                Vista activa: {activeTab}
              </Badge>
              <Badge variant='outline' className='h-8 px-3'>
                Datos en tiempo real
              </Badge>
            </div>
          </CardHeader>
        </Card>
      </StaggerItem>

      <StaggerItem>
        <AnimatedCard>
        <Card className={surfaceCardClass}>
          <CardContent className='p-4 sm:p-5'>
            <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full space-y-4'>
              <TabsList className='grid h-auto w-full grid-cols-2 gap-2 rounded-xl bg-slate-100/80 p-1 sm:grid-cols-4'>
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
                  <ReporteMovimientos />
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
