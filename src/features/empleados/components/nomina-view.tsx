"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, DollarSign, Download, Calendar, Filter, RefreshCw, TrendingUp, Users, Wallet, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getPagoSalariosAction } from "@/features/pago-salario/actions";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PayrollRecord {
  pgId: string;
  empleadoId: string;
  salario: number;
  bonificaciones: number;
  deducciones: number;
  aportes?: number;
  horasExtras: number;
  observaciones: string | null;
  periodo: string;
  createdAt: string;
  empleado: {
    nombre: string;
    apellido: string;
    cargo: string;
    salarioBases: number;
  };
}

function EditPayrollDialog({ 
  open, 
  onOpenChange, 
  record, 
  onSave 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  record: PayrollRecord | null; 
  onSave: (id: string, updates: Partial<PayrollRecord>) => void; 
}) {
  const [bonificaciones, setBonificaciones] = useState(0);
  const [deducciones, setDeducciones] = useState(0);
  const [aportes, setAportes] = useState(0);
  const [horasExtras, setHorasExtras] = useState(0);
  const [netSalary, setNetSalary] = useState(0);

  useEffect(() => {
    if (record) {
      setBonificaciones(record.bonificaciones);
      setDeducciones(record.deducciones);
      setAportes(record.aportes || 0);
      setHorasExtras(record.horasExtras);
      setNetSalary(record.salario);
    }
  }, [record]);

  useEffect(() => {
    if (record) {
      // Calculate Net Salary dynamically
      // Defaults: 240 hours/month, 1.5x overtime. 
      // Ideally should match backend config but this is a good approximation for UI feedback
      const hourlyRate = record.empleado.salarioBases / 240;
      const overtimePay = horasExtras * hourlyRate * 1.5;
      const gross = record.empleado.salarioBases + overtimePay + bonificaciones;
      const net = gross - deducciones;
      setNetSalary(Math.round(net));
    }
  }, [bonificaciones, deducciones, horasExtras, record]);

  const handleSave = () => {
    if (record) {
      onSave(record.pgId, {
        empleadoId: record.empleadoId,
        bonificaciones,
        deducciones,
        aportes,
        horasExtras,
        salario: netSalary
      });
      onOpenChange(false);
    }
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Nómina</DialogTitle>
          <DialogDescription>
            Ajustar detalles para {record.empleado.nombre} {record.empleado.apellido}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="base" className="text-right">
              Salario Base
            </Label>
            <Input
              id="base"
              value={new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'CUP' }).format(record.empleado.salarioBases)}
              disabled
              className="col-span-3 bg-muted"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="horas" className="text-right">
              Horas Extras
            </Label>
            <Input
              id="horas"
              type="number"
              value={horasExtras}
              onChange={(e) => setHorasExtras(Number(e.target.value))}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="bonos" className="text-right">
              Bonificaciones
            </Label>
            <Input
              id="bonos"
              type="number"
              value={bonificaciones}
              onChange={(e) => setBonificaciones(Number(e.target.value))}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="deducciones" className="text-right">
              Deducciones
            </Label>
            <Input
              id="deducciones"
              type="number"
              value={deducciones}
              onChange={(e) => setDeducciones(Number(e.target.value))}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="aportes" className="text-right">
              Aportes Patronales
            </Label>
            <Input
              id="aportes"
              type="number"
              value={aportes}
              onChange={(e) => setAportes(Number(e.target.value))}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="neto" className="text-right font-bold">
              Total Neto
            </Label>
            <div className="col-span-3 font-mono text-lg font-bold text-orange-600">
               {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'CUP' }).format(netSalary)}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" onClick={handleSave}>Guardar Cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


/**
 * Componente para visualización y cálculo de nómina con UI/UX Pro Max
 * @returns Componente de vista de nómina
 */
export function NominaView() {
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [forceRecalculate, setForceRecalculate] = useState(false);
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Cargar registros de nómina
  useEffect(() => {
    fetchPayrollRecords();
  }, []);

  const fetchPayrollRecords = async (periodoFilter?: string) => {
    setLoading(true);
    try {
      const url = periodoFilter
        ? `/api/empleados/nomina?periodo=${periodoFilter}`
        : "/api/empleados/nomina";

      const token = sessionStorage.getItem('token');
      const response = await fetch(url, {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPayrollRecords(data);
      }
    } catch (error) {
      console.error("Error cargando nómina:", error);
      toast.error("Error al cargar registros de nómina");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calcula la nómina para el período seleccionado
   */
  const handleCalculatePayroll = async () => {
    if (!periodo) {
      toast.error("Selecciona un período");
      return;
    }

    setCalculating(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch("/api/empleados/nomina", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          periodo,
          forceRecalculate
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // El API devuelve { payrolls: [...], vacationAccruals: [...], message: "...", existing?: true }
        const newPayrolls = data.payrolls || [];
        
        if (data.existing) {
          // Si ya existía nómina, reemplazar los registros actuales
          setPayrollRecords(newPayrolls);
          toast.info(data.message || `Nómina existente cargada para ${newPayrolls.length} empleados`);
        } else {
          // Si es nueva nómina, agregar a los registros existentes
          setPayrollRecords(prev => [...newPayrolls, ...prev]);
          toast.success(`Nómina calculada para ${newPayrolls.length} empleados`);
        }
        
        // Mostrar mensaje adicional si hay acumulación de vacaciones
        if (data.vacationAccruals) {
          const processedVacations = data.vacationAccruals.filter((v: any) => v.processed).length;
          if (processedVacations > 0) {
            toast.success(`Acumulación de vacaciones procesada para ${processedVacations} empleados`);
          }
        }
      } else {
        toast.error(data.error || "Error al calcular nómina");
      }
    } catch (error) {
      console.error("Error calculando nómina:", error);
      toast.error("Error interno del servidor");
    } finally {
      setCalculating(false);
    }
  };

  /**
   * Filtra registros por período
   */
  const handleFilterByPeriod = () => {
    fetchPayrollRecords(periodo);
  };

  /**
   * Formatea el monto como moneda
   */
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'CUP'
    }).format(amount);
  };

  /**
   * Calcula el total de la nómina
   */
  const calculateTotal = () => {
    return payrollRecords.reduce((total, record) => total + record.salario, 0);
  };

  const calculateAverage = () => {
    if (payrollRecords.length === 0) return 0;
    return calculateTotal() / payrollRecords.length;
  };

  const handleEdit = (record: PayrollRecord) => {
    setEditingRecord(record);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async (id: string, updates: Partial<PayrollRecord>) => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`/api/pago-salario/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedRecord = await response.json();
        setPayrollRecords(prev => prev.map(r => r.pgId === id ? { ...r, ...updatedRecord, empleado: r.empleado } : r));
        toast.success("Registro actualizado");
      } else {
        toast.error("Error al actualizar");
      }
    } catch (error) {
      console.error("Error updating:", error);
      toast.error("Error al actualizar");
    }
  };

  return (
    <div className="space-y-8">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-l-4 border-l-chart-2 shadow-sm bg-linear-to-br from-card to-chart-2/10 dark:to-chart-2/5">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Nómina</p>
                  <h3 className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {formatCurrency(calculateTotal())}
                  </h3>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
                  <Wallet className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-l-4 border-l-primary shadow-sm bg-linear-to-br from-card to-primary/10 dark:to-primary/5">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Promedio por Empleado</p>
                  <h3 className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(calculateAverage())}
                  </h3>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-l-4 border-l-chart-3 shadow-sm bg-linear-to-br from-card to-chart-3/10 dark:to-chart-3/5">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Empleados</p>
                  <h3 className="text-3xl font-bold text-violet-600 dark:text-violet-400">
                    {payrollRecords.length}
                  </h3>
                </div>
                <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Controls & Toolbar */}
      <Card className="border-none shadow-none bg-background/50 backdrop-blur-sm border-y rounded-none md:rounded-xl md:border">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col lg:flex-row gap-6 justify-between items-center">
            <div className="flex flex-col sm:flex-row gap-4 items-center w-full lg:w-auto">
              <div className="relative w-full sm:w-auto">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="month"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="pl-10 h-11 w-full sm:w-48 bg-background border-input hover:border-primary/50 transition-colors"
                />
              </div>
              
              <Button
                onClick={handleFilterByPeriod}
                variant="outline"
                className="h-11 w-full sm:w-auto border-dashed hover:border-solid hover:bg-muted/50"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtrar
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center w-full lg:w-auto">
              <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg border">
                <Switch
                  id="force-recalc"
                  checked={forceRecalculate}
                  onCheckedChange={setForceRecalculate}
                />
                <Label htmlFor="force-recalc" className="cursor-pointer text-sm font-medium text-muted-foreground">
                  Forzar recálculo
                </Label>
              </div>

              <Button
                onClick={handleCalculatePayroll}
                disabled={calculating}
                className="h-11 w-full sm:w-auto bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-md hover:shadow-lg transition-all"
              >
                {calculating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Calculando...
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4 mr-2" />
                    Calcular Nómina
                  </>
                )}
              </Button>

              <Button
                onClick={() => {
                  const url = new URL('/api/empleados/nomina/pdf', window.location.origin)
                  if (periodo) url.searchParams.set('periodo', periodo)
                  window.open(url.toString(), '_blank')
                }}
                variant="outline"
                className="h-11 w-full sm:w-auto border-orange-200 dark:border-orange-900 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:border-orange-300 transition-all"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="overflow-hidden border-none shadow-md bg-card">
        <div className="p-1">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[250px] py-4">Empleado</TableHead>
                <TableHead className="py-4">Salario Base</TableHead>
                <TableHead className="py-4 text-orange-600 dark:text-orange-400">Bonificaciones</TableHead>
                <TableHead className="py-4 text-red-600 dark:text-red-400">Deducciones</TableHead>
                <TableHead className="py-4">Horas Extras</TableHead>
                <TableHead className="py-4 text-right">Total Neto</TableHead>
                <TableHead className="py-4 text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex justify-center items-center gap-2 text-muted-foreground">
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        Cargando registros...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : payrollRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <div className="p-4 bg-muted/50 rounded-full mb-4">
                          <Calculator className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">No hay registros de nómina</h3>
                        <p className="max-w-sm mt-1">
                          No se encontraron registros para el período seleccionado. Intenta calcular la nómina o cambiar el filtro.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  payrollRecords.map((record, index) => (
                    <motion.tr
                      key={record.pgId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      className="group border-b hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="py-4 font-medium">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-xs font-bold text-orange-700 dark:text-orange-400">
                            {record.empleado.nombre.charAt(0)}{record.empleado.apellido.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span>{record.empleado.nombre} {record.empleado.apellido}</span>
                            <span className="text-xs text-muted-foreground font-normal">{record.empleado.cargo}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-muted-foreground font-mono">
                        {formatCurrency(record.empleado.salarioBases)}
                      </TableCell>
                      <TableCell className="py-4 text-orange-600 dark:text-orange-400 font-mono">
                        +{formatCurrency(record.bonificaciones)}
                      </TableCell>
                      <TableCell className="py-4 text-red-600 dark:text-red-400 font-mono">
                        -{formatCurrency(record.deducciones)}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="font-mono">
                          {record.horasExtras}h
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <span className="font-bold text-lg text-foreground font-mono">
                          {formatCurrency(record.salario)}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-muted"
                            onClick={() => handleEdit(record)}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-transparent">
                            Procesado
                          </Badge>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      </Card>
      
      <EditPayrollDialog 
        open={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen} 
        record={editingRecord} 
        onSave={handleSaveEdit} 
      />
    </div>
  );
}
