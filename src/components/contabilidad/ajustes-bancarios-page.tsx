'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  DollarSign,
  History,
  Plus,
  Settings,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { CuentaBancaria, useGetCuentasBancariasQuery } from '@/lib/redux/contabilidad';

import { AjusteBancarioForm } from './ajuste-bancario-form';
import { HistorialAjustesTable } from './historial-ajustes-table';

const surfaceCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-950/50',
);

/**
 * @description Centro de gestión para crear ajustes manuales y consultar historial.
 * @returns {JSX.Element} Vista operativa de ajustes bancarios.
 */
export function AjustesBancariosPage() {
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState('nuevo');
  const [selectedCuentaId, setSelectedCuentaId] = useState('all');

  const { data: cuentas = { cuentas: [] } } = useGetCuentasBancariasQuery();
  const cuentasBancarias: CuentaBancaria[] = cuentas.cuentas || [];
  const activeCuentas = cuentasBancarias.filter((cuenta) => cuenta.isActive);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 14 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.32,
        ease: 'easeOut' as const,
      },
    },
  };

  /**
   * @description Navega al historial tras registrar un ajuste exitoso.
   * @returns {void} Sin retorno.
   */
  const handleAjusteSuccess = (): void => {
    setActiveTab('historial');
  };

  return (
    <motion.div
      className="space-y-6 p-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div
        variants={itemVariants}
        className={cn(surfaceCardClass, 'flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between')}
      >
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Centro de Ajustes Bancarios
          </h2>
          <p className="text-sm text-muted-foreground">
            Registra correcciones manuales y audita cada movimiento en una sola vista.
          </p>
        </div>
        <Badge
          variant="outline"
          className="w-fit border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
        >
          <Settings className="mr-1.5 h-3.5 w-3.5" />
          Proceso controlado
        </Badge>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="border-amber-300/70 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-900/15">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-300" />
              <div className="space-y-1">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                  Reglas de control en ajustes manuales
                </h3>
                <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-300">
                  <li>• Cada ajuste requiere descripción y motivo.</li>
                  <li>• Se registra usuario, fecha y detalle completo en auditoría.</li>
                  <li>• Ajustes que generan saldo negativo disparan advertencia.</li>
                  <li>• Soporta múltiples monedas con conversión automática.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {activeCuentas.length > 0 && (
        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeCuentas.slice(0, 3).map((cuenta, index) => (
            <motion.div
              key={cuenta.cuentaId}
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: shouldReduceMotion ? 0 : index * 0.04 }}
            >
              <Card className={cn(surfaceCardClass, 'transition-all duration-300 hover:-translate-y-1 hover:shadow-lg')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {cuenta.nombreBanco}
                      </p>
                      <p className="text-xs text-muted-foreground">{cuenta.numeroCuenta}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        {Number(cuenta.saldo).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">{cuenta.moneda}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-900/70">
            <TabsTrigger value="nuevo" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nuevo ajuste
            </TabsTrigger>
            <TabsTrigger value="historial" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historial
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value="nuevo" className="mt-6">
              <motion.div
                key="tab-nuevo"
                initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: shouldReduceMotion ? 0 : 16 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
              >
                <Card className={surfaceCardClass}>
                  <CardHeader>
                    <CardTitle>Registrar nuevo ajuste</CardTitle>
                    <CardDescription>
                      Complete el formulario para registrar una corrección manual.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AjusteBancarioForm onSuccess={handleAjusteSuccess} />
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="historial" className="mt-6">
              <motion.div
                key="tab-historial"
                initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -16 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
              >
                <Card className={cn(surfaceCardClass, 'mb-6')}>
                  <CardHeader>
                    <CardTitle className="text-lg">Filtros de historial</CardTitle>
                    <CardDescription>
                      Seleccione una cuenta específica o visualice todos los ajustes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-end gap-3 md:flex-row">
                      <div className="w-full flex-1 space-y-2">
                        <Label htmlFor="cuenta-filter">Filtrar por cuenta</Label>
                        <Select value={selectedCuentaId} onValueChange={setSelectedCuentaId}>
                          <SelectTrigger id="cuenta-filter">
                            <SelectValue placeholder="Todas las cuentas" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas las cuentas</SelectItem>
                            {cuentasBancarias.map((cuenta) => (
                              <SelectItem key={cuenta.cuentaId} value={cuenta.cuentaId}>
                                {cuenta.nombreBanco} - {cuenta.numeroCuenta}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedCuentaId !== 'all' && (
                        <Button
                          variant="outline"
                          onClick={() => setSelectedCuentaId('all')}
                          className="w-full md:mt-6 md:w-auto"
                        >
                          Limpiar filtro
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className={surfaceCardClass}>
                  <CardHeader>
                    <CardTitle>Historial de movimientos</CardTitle>
                    <CardDescription>
                      Registro detallado de los ajustes realizados en el sistema.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <HistorialAjustesTable
                      cuentaId={selectedCuentaId === 'all' ? undefined : selectedCuentaId}
                      showAllAccounts={selectedCuentaId === 'all'}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className={surfaceCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              Tipos de ajustes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  <h3 className="font-semibold text-emerald-800 dark:text-emerald-300">
                    Ajustes de ingreso
                  </h3>
                </div>
                <ul className="ml-7 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <li>• Depósitos no registrados automáticamente.</li>
                  <li>• Correcciones por errores de registro.</li>
                  <li>• Intereses bancarios.</li>
                  <li>• Otros ingresos externos al sistema.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-300" />
                  <h3 className="font-semibold text-red-800 dark:text-red-300">
                    Ajustes de egreso
                  </h3>
                </div>
                <ul className="ml-7 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <li>• Comisiones bancarias.</li>
                  <li>• Retiros no registrados.</li>
                  <li>• Correcciones por sobrestimación.</li>
                  <li>• Otros gastos externos al sistema.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
